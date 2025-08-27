import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import axios from 'axios';
import * as pdfParse from 'pdf-parse';

admin.initializeApp();

const AI_SERVICE_URL = "https://recall-ai-service-15375066513.us-east1.run.app";

export const onFileUpload = functions.region('us-east1').runWith({ 
  timeoutSeconds: 540,
  memory: '1GB'
}).storage.object().onFinalize(async (object) => {
  const bucket = admin.storage().bucket(object.bucket);
  const filePath = object.name;
  const contentType = object.contentType;
  const fileSize = object.size;

  // Extract user ID and file type from path
  // Format: uploads/{type}/{userId}/{filename} where type is 'documents' or 'audio'
  const pathParts = filePath?.split('/');
  let userId = null;
  let fileType = null;
  
  if (pathParts && pathParts.length >= 4 && pathParts[0] === 'uploads') {
    fileType = pathParts[1]; // 'documents' or 'audio'
    userId = pathParts[2];
  }

  if (!userId || !fileType) {
    functions.logger.error("Could not extract user ID or file type from file path. File path should be: uploads/{type}/{userId}/{filename}");
    return;
  }

  // Validate file path and content type
  if (!filePath || !contentType) {
    functions.logger.error("File path or content type not available.");
    return;
  }

  functions.logger.info(`Processing ${fileType} file for user ${userId}: ${filePath}`);

  // Different validation based on file type
  if (fileType === 'documents') {
    // Validate document file size (max 10MB)
    const maxDocumentSize = 10 * 1024 * 1024; // 10MB
    if (fileSize && parseInt(fileSize) > maxDocumentSize) {
      functions.logger.error(`Document size ${fileSize} exceeds maximum allowed size of ${maxDocumentSize} bytes.`);
      return;
    }

    // Validate document file type (only PDF and TXT)
    const allowedDocumentTypes = ['application/pdf', 'text/plain'];
    if (!allowedDocumentTypes.some(type => contentType.startsWith(type))) {
      functions.logger.error(`Unsupported document type: ${contentType}. Only PDF and TXT files are allowed.`);
      return;
    }

    // Validate document file extension
    const allowedDocumentExtensions = ['.pdf', '.txt'];
    const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    if (!allowedDocumentExtensions.includes(fileExtension)) {
      functions.logger.error(`Invalid document extension: ${fileExtension}. Only .pdf and .txt files are allowed.`);
      return;
    }
  } else if (fileType === 'audio') {
    // Validate audio file size (max 50MB)
    const maxAudioSize = 50 * 1024 * 1024; // 50MB
    if (fileSize && parseInt(fileSize) > maxAudioSize) {
      functions.logger.error(`Audio size ${fileSize} exceeds maximum allowed size of ${maxAudioSize} bytes.`);
      return;
    }

    // Validate audio file type
    const allowedAudioTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mpeg'];
    if (!allowedAudioTypes.some(type => contentType.startsWith(type))) {
      functions.logger.error(`Unsupported audio type: ${contentType}. Only MP3, WAV, M4A, FLAC, AAC, OGG files are allowed.`);
      return;
    }

    // Validate audio file extension
    const allowedAudioExtensions = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg'];
    const fileExtension = filePath.toLowerCase().substring(filePath.lastIndexOf('.'));
    if (!allowedAudioExtensions.includes(fileExtension)) {
      functions.logger.error(`Invalid audio extension: ${fileExtension}. Only audio files are allowed.`);
      return;
    }
  } else {
    functions.logger.error(`Unknown file type: ${fileType}. Only 'documents' and 'audio' are supported.`);
    return;
  }

  let aiServiceResponse;

  try {
    if (fileType === 'documents') {
      // Process document files (existing logic)
      const file = bucket.file(filePath);
      let fileBuffer: Buffer[];
      
      try {
        fileBuffer = await file.download();
      } catch (error) {
        functions.logger.error("Failed to download document:", error);
        return;
      }

      // Validate file is not empty
      if (!fileBuffer[0] || fileBuffer[0].length === 0) {
        functions.logger.error("Document is empty or corrupted.");
        return;
      }

      let textContent = '';
      try {
        if (contentType.startsWith('application/pdf')) {
          const data = await pdfParse(fileBuffer[0]);
          textContent = data.text;
        } else {
          textContent = fileBuffer[0].toString('utf-8');
        }
      } catch (error) {
        functions.logger.error("Failed to extract text from document:", error);
        return;
      }

      // Validate extracted content
      if (!textContent.trim()) {
        functions.logger.error("Extracted text content is empty.");
        return;
      }

      // Validate text content length
      const minTextLength = 10;
      const maxTextLength = 100000; // Increased for Gemini's large context
      if (textContent.length < minTextLength) {
        functions.logger.error(`Text content too short: ${textContent.length} characters. Minimum required: ${minTextLength}`);
        return;
      }
      if (textContent.length > maxTextLength) {
        functions.logger.warn(`Text content very long: ${textContent.length} characters. Truncating to ${maxTextLength}.`);
        textContent = textContent.substring(0, maxTextLength);
      }

      functions.logger.info("Sending document text to AI service for processing...");
      aiServiceResponse = await axios.post(`${AI_SERVICE_URL}/process`, { 
        text: textContent,
        num_cards: 15  // Request more cards for documents
      });

    } else if (fileType === 'audio') {
      // Process audio files using the new audio endpoint
      functions.logger.info("Sending audio file to AI service for processing...");
      
      // Process audio file
      const file = bucket.file(filePath);

      // Create form data for audio processing
      const FormData = require('form-data');
      const form = new FormData();
      
      // Download the file and add to form
      const [fileBuffer] = await file.download();
      const originalFilename = pathParts ? pathParts[3] : 'audio_file';
      form.append('audio', fileBuffer, {
        filename: originalFilename,
        contentType: contentType
      });
      form.append('num_cards', '12'); // Request cards for audio
      
      aiServiceResponse = await axios.post(`${AI_SERVICE_URL}/process-audio`, form, {
        headers: {
          ...form.getHeaders(),
        },
        timeout: 300000, // 5 minutes timeout for audio processing
        maxContentLength: 50 * 1024 * 1024, // 50MB
      });
    }

    functions.logger.info("Received response from AI service");
    
    if (!aiServiceResponse) {
      functions.logger.error("No response received from AI service");
      return;
    }
    
    const aiData = aiServiceResponse.data;

    // Validate AI service response
    if (!aiData.success || !aiData.flashcards || !Array.isArray(aiData.flashcards)) {
      functions.logger.error("Invalid response from AI service:", aiData);
      return;
    }

    const flashcards = aiData.flashcards;
    
    if (flashcards.length === 0) {
      functions.logger.warn("AI service returned no flashcards");
      return;
    }

    const db = admin.firestore();
    const filename = filePath.split('/').pop()?.split('.')[0] || `deck-${Date.now()}`;
    const deckId = `${userId}_${filename}_${Date.now()}`;
    
    // Prepare deck document
    const deckData: any = {
      title: object.name?.split('/').pop() || "Untitled Deck",
      userId: userId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'completed',
      total_cards: flashcards.length,
      source_type: fileType,
      model_used: aiData.model || 'gemini-1.5-pro-latest'
    };

    // Add audio-specific metadata if this is an audio file
    if (fileType === 'audio' && aiData.transcription) {
      deckData.transcription = {
        text: aiData.transcription.text,
        language: aiData.transcription.language,
        duration: aiData.transcription.duration,
        segments_count: aiData.transcription.segments ? aiData.transcription.segments.length : 0
      };
      
      if (aiData.audio_info) {
        deckData.audio_info = aiData.audio_info;
      }
    }
    
    // Create deck document
    await db.collection('decks').doc(deckId).set(deckData);

    // Save individual flashcards
    const batch = db.batch();
    
    flashcards.forEach((card: any, index: number) => {
      // Validate and enhance card data
      const cardData = {
        id: card.id || `card_${index + 1}`,
        type: card.type || 'qa',
        question: card.question || 'No question generated',
        answer: card.answer || 'No answer provided',
        source_text: card.source_text || 'Source text not available',
        difficulty: card.difficulty || 'medium',
        created_at: admin.firestore.FieldValue.serverTimestamp()
      };

      const cardRef = db.collection('decks').doc(deckId).collection('cards').doc(cardData.id);
      batch.set(cardRef, cardData);
    });

    await batch.commit();

    functions.logger.info(`Successfully processed file and saved ${flashcards.length} flashcards to deck: ${deckId}`);

  } catch (error) {
    functions.logger.error("Error calling AI service or saving to Firestore:", error);
    
    // Create a failed deck entry for user awareness
    try {
      const db = admin.firestore();
      const filename = filePath.split('/').pop()?.split('.')[0] || `deck-${Date.now()}`;
      const deckId = `${userId}_${filename}_${Date.now()}_failed`;
      
      await db.collection('decks').doc(deckId).set({
        title: object.name?.split('/').pop() || "Failed Processing",
        userId: userId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error occurred',
        total_cards: 0
      });
      
      functions.logger.info(`Created failed deck entry: ${deckId}`);
    } catch (dbError) {
      functions.logger.error("Failed to create error deck entry:", dbError);
    }
  }

  return;
});

const nextApp = require("next")({
  dev: false,
  dir: "./app",
});
const handle = nextApp.getRequestHandler();

export const nextServer = functions.region('us-east1').https.onRequest((req, res) => {
  return nextApp.prepare().then(() => handle(req, res));
});


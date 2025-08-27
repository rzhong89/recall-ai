from flask import Flask, request, jsonify
from flask_cors import CORS
import logging
import os
import tempfile
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from gemini_generator import GeminiFlashcardGenerator
from audio_transcriber import AudioTranscriber
from anki_exporter import AnkiExporter

# Load environment variables
load_dotenv()

app = Flask(__name__)

# Enable CORS for all routes
CORS(app, origins=[
    "http://localhost:3000",  # Local development
    "https://recallai-30d22.web.app",  # Firebase hosting production
    "https://recallai-30d22.firebaseapp.com"  # Firebase hosting alternative
])

# Set up logging
logging.basicConfig(level=os.getenv('LOG_LEVEL', 'INFO'))
logger = logging.getLogger(__name__)

# Initialize generators
try:
    flashcard_generator = GeminiFlashcardGenerator()
    audio_transcriber = AudioTranscriber(model_size="base")  # Can be configured
    anki_exporter = AnkiExporter()
    logger.info("AI services initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize AI services: {e}")
    flashcard_generator = None
    audio_transcriber = None
    anki_exporter = None

# Configuration
app.config['MAX_CONTENT_LENGTH'] = 50 * 1024 * 1024  # 50MB max file size
ALLOWED_TEXT_EXTENSIONS = {'txt', 'pdf'}
ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'}

def allowed_file(filename, allowed_extensions):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in allowed_extensions

@app.route('/process', methods=['POST'])
def process_text():
    """Process text content and generate flashcards"""
    try:
        if not flashcard_generator:
            return jsonify({"error": "Flashcard generator not available"}), 503

        data = request.get_json()
        if not data or 'text' not in data:
            logger.error("No text provided in request")
            return jsonify({"error": "No text provided"}), 400

        text = data['text']
        num_cards = data.get('num_cards', 10)  # Default to 10 cards
        
        if not text.strip():
            logger.error("Empty text provided")
            return jsonify({"error": "Text cannot be empty"}), 400

        logger.info(f"Processing text of length: {len(text)} characters")

        # Generate flashcards using Gemini
        flashcards = flashcard_generator.generate_flashcards(text, num_cards)
        
        if not flashcards:
            logger.warning("No flashcards generated from text")
            return jsonify({"error": "Could not generate flashcards from the provided text"}), 400

        logger.info(f"Generated {len(flashcards)} flashcards using Gemini Pro 1.5")

        return jsonify({
            "success": True,
            "flashcards": flashcards,
            "count": len(flashcards),
            "model": "gemini-1.5-pro-latest"
        })

    except Exception as e:
        logger.error(f"Error processing text: {str(e)}")
        return jsonify({"error": "Internal server error during text processing"}), 500

@app.route('/process-audio', methods=['POST'])
def process_audio():
    """Process audio file, transcribe, and generate flashcards"""
    try:
        if not audio_transcriber or not flashcard_generator:
            return jsonify({"error": "Audio processing services not available"}), 503

        # Check if file was uploaded
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        file = request.files['audio']
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400

        # Validate file type
        if not allowed_file(file.filename, ALLOWED_AUDIO_EXTENSIONS):
            return jsonify({"error": f"Unsupported audio format. Allowed: {', '.join(ALLOWED_AUDIO_EXTENSIONS)}"}), 400

        # Get optional parameters
        language = request.form.get('language')  # Optional language hint
        num_cards = int(request.form.get('num_cards', 10))

        logger.info(f"Processing audio file: {file.filename}")

        # Save uploaded file temporarily
        temp_dir = tempfile.mkdtemp()
        filename = secure_filename(file.filename)
        temp_path = os.path.join(temp_dir, filename)
        file.save(temp_path)

        try:
            # Get audio info
            audio_info = audio_transcriber.get_audio_info(temp_path)
            logger.info(f"Audio info: {audio_info.get('duration_minutes', 0):.1f} minutes, {audio_info.get('file_size_mb', 0):.1f} MB")

            # Transcribe audio
            logger.info("Starting audio transcription")
            transcription_result = audio_transcriber.transcribe_long_audio(temp_path, language)
            
            transcribed_text = transcription_result["text"]
            detected_language = transcription_result["language"]
            
            if not transcribed_text.strip():
                return jsonify({"error": "No speech detected in audio file"}), 400

            logger.info(f"Transcription completed. Text length: {len(transcribed_text)} characters, Language: {detected_language}")

            # Generate flashcards from transcription
            logger.info("Generating flashcards from transcription")
            flashcards = flashcard_generator.generate_flashcards(transcribed_text, num_cards)
            
            if not flashcards:
                return jsonify({"error": "Could not generate flashcards from the transcribed audio"}), 400

            logger.info(f"Generated {len(flashcards)} flashcards from audio")

            return jsonify({
                "success": True,
                "flashcards": flashcards,
                "count": len(flashcards),
                "transcription": {
                    "text": transcribed_text,
                    "language": detected_language,
                    "duration": transcription_result["duration"],
                    "segments": transcription_result["segments"]
                },
                "audio_info": audio_info,
                "model": "gemini-1.5-pro-latest + whisper-base"
            })

        finally:
            # Clean up temporary files
            if os.path.exists(temp_path):
                os.unlink(temp_path)
            os.rmdir(temp_dir)

    except Exception as e:
        logger.error(f"Error processing audio: {str(e)}")
        return jsonify({"error": "Internal server error during audio processing"}), 500

@app.route('/export-anki', methods=['POST'])
def export_anki():
    """Export flashcards as Anki .apkg file"""
    try:
        if not anki_exporter:
            return jsonify({"error": "Anki export service not available"}), 503

        data = request.get_json()
        if not data or 'flashcards' not in data:
            logger.error("No flashcards provided in request")
            return jsonify({"error": "No flashcards provided"}), 400

        flashcards = data['flashcards']
        deck_name = data.get('deck_name', 'FlashGen Export')
        
        if not flashcards:
            logger.error("Empty flashcards list provided")
            return jsonify({"error": "Flashcards list cannot be empty"}), 400

        logger.info(f"Exporting {len(flashcards)} flashcards to Anki deck: {deck_name}")

        # Create Anki deck
        apkg_path = anki_exporter.create_anki_deck(flashcards, deck_name)
        
        try:
            # Read the file and return it as response
            with open(apkg_path, 'rb') as f:
                apkg_data = f.read()
            
            # Clean up the temporary file
            anki_exporter.cleanup_temp_file(apkg_path)
            
            logger.info(f"Successfully exported Anki deck with {len(flashcards)} cards")
            
            # Return the file data as base64 for frontend to download
            import base64
            apkg_base64 = base64.b64encode(apkg_data).decode('utf-8')
            
            return jsonify({
                "success": True,
                "filename": f"{deck_name}.apkg",
                "data": apkg_base64,
                "size": len(apkg_data),
                "cards_exported": len(flashcards)
            })
            
        except Exception as e:
            # Ensure cleanup even if reading fails
            anki_exporter.cleanup_temp_file(apkg_path)
            raise e

    except Exception as e:
        logger.error(f"Error exporting to Anki: {str(e)}")
        return jsonify({"error": "Internal server error during Anki export"}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    try:
        health_status = {
            "service": "RecallAI Flashcard Generator",
            "status": "healthy",
            "components": {}
        }

        # Check Gemini flashcard generator
        if flashcard_generator:
            gemini_health = flashcard_generator.health_check()
            health_status["components"]["gemini"] = gemini_health
        else:
            health_status["components"]["gemini"] = {"status": "unavailable"}

        # Check Whisper audio transcriber
        if audio_transcriber:
            whisper_health = audio_transcriber.health_check()
            health_status["components"]["whisper"] = whisper_health
        else:
            health_status["components"]["whisper"] = {"status": "unavailable"}

        # Check Anki exporter
        if anki_exporter:
            anki_health = anki_exporter.health_check()
            health_status["components"]["anki"] = anki_health
        else:
            health_status["components"]["anki"] = {"status": "unavailable"}

        # Overall status
        if any(comp.get("status") == "unhealthy" for comp in health_status["components"].values()):
            health_status["status"] = "degraded"

        return jsonify(health_status)

    except Exception as e:
        return jsonify({
            "service": "RecallAI Flashcard Generator",
            "status": "unhealthy",
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8080)
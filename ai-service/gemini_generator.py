import os
import json
import re
import logging
from typing import List, Dict, Any, Optional
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class GeminiFlashcardGenerator:
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini flashcard generator
        """
        self.api_key = api_key or os.getenv('GOOGLE_API_KEY')
        if not self.api_key:
            raise ValueError("Google API key is required. Set GOOGLE_API_KEY environment variable.")
        
        # Configure Gemini
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-pro-latest')
        
        # Configuration
        self.generation_config = {
            'temperature': 0.7,
            'top_p': 0.8,
            'top_k': 40,
            'max_output_tokens': 4096,
        }
        
        self.safety_settings = [
            {
                "category": "HARM_CATEGORY_HARASSMENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_HATE_SPEECH",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            },
            {
                "category": "HARM_CATEGORY_DANGEROUS_CONTENT",
                "threshold": "BLOCK_MEDIUM_AND_ABOVE"
            }
        ]

    def preprocess_text(self, text: str) -> str:
        """
        Clean and preprocess text for better flashcard generation
        """
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        
        # Remove special characters that might confuse the model
        text = re.sub(r'[^\w\s\.\,\?\!\:\;\(\)\-\'\"]', ' ', text)
        
        # Limit text length for optimal processing (Gemini can handle large context but let's be efficient)
        max_chars = 100000  # ~25,000 words
        if len(text) > max_chars:
            # Try to cut at sentence boundary
            text = text[:max_chars]
            last_period = text.rfind('.')
            if last_period > max_chars * 0.8:  # If we find a period in the last 20%
                text = text[:last_period + 1]
        
        return text.strip()

    def create_flashcard_prompt(self, text: str, num_cards: int = 10) -> str:
        """
        Create an optimized prompt for Gemini to generate flashcards
        """
        prompt = f"""
You are an expert educational content creator specializing in creating effective flashcards for spaced repetition learning.

Analyze the following educational content and generate exactly {num_cards} high-quality flashcards.

CONTENT:
{text}

REQUIREMENTS:
1. Generate exactly {num_cards} flashcards
2. Mix different card types:
   - 60% Q&A cards (question → answer)
   - 25% Cloze deletion cards (fill in the blank)
   - 15% Definition cards (term → definition)
3. Focus on the most important concepts, facts, and relationships
4. Questions should test understanding, not just memorization
5. Vary difficulty levels (easy, medium, hard)
6. Ensure answers are concise but complete
7. For cloze cards, replace key terms with "______"

OUTPUT FORMAT:
Return ONLY a valid JSON object with this exact structure:

{{
  "flashcards": [
    {{
      "type": "qa",
      "question": "Clear, specific question",
      "answer": "Accurate, concise answer",
      "difficulty": "easy|medium|hard",
      "source_text": "Original text segment this card is based on"
    }},
    {{
      "type": "cloze",
      "question": "Text with ______ blanks for key terms",
      "answer": "The missing word or phrase",
      "difficulty": "easy|medium|hard",
      "source_text": "Original text segment this card is based on"
    }},
    {{
      "type": "definition",
      "question": "What is [term]?",
      "answer": "Clear definition of the term",
      "difficulty": "easy|medium|hard",
      "source_text": "Original text segment this card is based on"
    }}
  ]
}}

IMPORTANT: Return ONLY the JSON object, no additional text or formatting.
"""
        return prompt

    def generate_flashcards(self, text: str, num_cards: int = 10) -> List[Dict[str, Any]]:
        """
        Generate flashcards using Gemini Pro 1.5
        """
        try:
            logger.info(f"Starting flashcard generation for text of length {len(text)}")
            
            # Preprocess text
            cleaned_text = self.preprocess_text(text)
            
            if len(cleaned_text.strip()) < 50:
                logger.warning("Text too short for meaningful flashcard generation")
                return []
            
            # Create prompt
            prompt = self.create_flashcard_prompt(cleaned_text, num_cards)
            
            # Generate content
            logger.info("Sending request to Gemini Pro 1.5")
            response = self.model.generate_content(
                prompt,
                generation_config=self.generation_config,
                safety_settings=self.safety_settings
            )
            
            if not response.text:
                logger.error("Empty response from Gemini")
                return []
            
            logger.info("Received response from Gemini, parsing JSON")
            
            # Parse JSON response
            try:
                # Clean the response text
                response_text = response.text.strip()
                
                # Remove markdown formatting if present
                if response_text.startswith('```json'):
                    response_text = response_text[7:]
                if response_text.endswith('```'):
                    response_text = response_text[:-3]
                
                # Parse JSON
                flashcard_data = json.loads(response_text)
                
                if 'flashcards' not in flashcard_data:
                    logger.error("Invalid response format: missing 'flashcards' key")
                    return []
                
                flashcards = flashcard_data['flashcards']
                
                # Validate and enhance flashcards
                validated_cards = []
                for i, card in enumerate(flashcards):
                    if self.validate_flashcard(card):
                        # Add metadata
                        card['id'] = f"card_{i+1}"
                        card['created_at'] = "server_timestamp"
                        validated_cards.append(card)
                    else:
                        logger.warning(f"Skipping invalid flashcard: {card}")
                
                logger.info(f"Successfully generated {len(validated_cards)} valid flashcards")
                return validated_cards
                
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse JSON response: {e}")
                logger.error(f"Response text: {response.text[:500]}...")
                return self.fallback_flashcard_generation(cleaned_text, num_cards)
                
        except Exception as e:
            logger.error(f"Error generating flashcards with Gemini: {e}")
            return self.fallback_flashcard_generation(text, num_cards)

    def validate_flashcard(self, card: Dict[str, Any]) -> bool:
        """
        Validate a flashcard has required fields
        """
        required_fields = ['type', 'question', 'answer']
        
        if not all(field in card for field in required_fields):
            return False
        
        if not all(isinstance(card[field], str) and card[field].strip() for field in required_fields):
            return False
        
        if card['type'] not in ['qa', 'cloze', 'definition']:
            return False
        
        return True

    def fallback_flashcard_generation(self, text: str, num_cards: int) -> List[Dict[str, Any]]:
        """
        Fallback method for generating flashcards if Gemini fails
        """
        logger.info("Using fallback flashcard generation")
        
        # Simple sentence-based card generation
        sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 20]
        
        if not sentences:
            return []
        
        flashcards = []
        for i, sentence in enumerate(sentences[:num_cards]):
            # Create a simple Q&A card
            words = sentence.split()
            if len(words) > 5:
                # Create a question by asking about the sentence
                question = f"What does this statement mean: '{sentence[:100]}...'" if len(sentence) > 100 else f"What does this statement mean: '{sentence}'"
                
                flashcard = {
                    "id": f"fallback_card_{i+1}",
                    "type": "qa",
                    "question": question,
                    "answer": sentence,
                    "difficulty": "medium",
                    "source_text": sentence,
                    "created_at": "server_timestamp"
                }
                flashcards.append(flashcard)
        
        logger.info(f"Generated {len(flashcards)} fallback flashcards")
        return flashcards

    def health_check(self) -> Dict[str, Any]:
        """
        Check if Gemini API is accessible
        """
        try:
            # Simple test query
            response = self.model.generate_content(
                "Generate one flashcard about the concept of gravity in JSON format.",
                generation_config={'max_output_tokens': 100}
            )
            
            return {
                "status": "healthy",
                "model": "gemini-1.5-pro-latest",
                "api_accessible": True,
                "test_response_length": len(response.text) if response.text else 0
            }
        except Exception as e:
            return {
                "status": "unhealthy",
                "model": "gemini-1.5-pro-latest",
                "api_accessible": False,
                "error": str(e)
            }
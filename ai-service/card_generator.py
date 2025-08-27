import re
import random
from typing import List, Dict, Any
from transformers import T5ForConditionalGeneration, T5Tokenizer
import torch

class FlashcardGenerator:
    def __init__(self, model_name="t5-small"):
        self.tokenizer = T5Tokenizer.from_pretrained(model_name)
        self.model = T5ForConditionalGeneration.from_pretrained(model_name)
        
    def preprocess_text(self, text: str) -> List[str]:
        """
        Preprocess text into chunks suitable for flashcard generation.
        """
        # Clean the text
        text = re.sub(r'\s+', ' ', text)  # Normalize whitespace
        text = text.strip()
        
        # Split into sentences
        sentences = re.split(r'[.!?]+', text)
        sentences = [s.strip() for s in sentences if s.strip() and len(s.strip()) > 20]
        
        # Group sentences into chunks of 2-3 sentences
        chunks = []
        for i in range(0, len(sentences), 2):
            chunk = '. '.join(sentences[i:i+2])
            if len(chunk) > 30 and len(chunk) < 500:  # Reasonable chunk size
                chunks.append(chunk)
        
        return chunks[:20]  # Limit to 20 chunks to avoid too many cards
    
    def generate_qa_card(self, text: str) -> Dict[str, Any]:
        """
        Generate a Q&A flashcard from text.
        """
        try:
            # Generate question
            question_prompt = f"generate question: {text}"
            question_inputs = self.tokenizer.encode(question_prompt, return_tensors="pt", max_length=512, truncation=True)
            question_outputs = self.model.generate(
                question_inputs, 
                max_length=100, 
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
            question = self.tokenizer.decode(question_outputs[0], skip_special_tokens=True)
            
            # Clean up the question
            if question.startswith("question:"):
                question = question[9:].strip()
            if not question.endswith('?'):
                question += '?'
            
            return {
                "type": "qa",
                "question": question.capitalize(),
                "answer": text,
                "source_text": text
            }
        except Exception as e:
            return {
                "type": "qa",
                "question": "What is the main concept described in this text?",
                "answer": text,
                "source_text": text
            }
    
    def generate_cloze_card(self, text: str) -> Dict[str, Any]:
        """
        Generate a cloze deletion flashcard from text.
        """
        try:
            # Find key terms to create cloze deletions
            words = text.split()
            if len(words) < 5:
                return None
            
            # Select important words (nouns, longer words)
            important_words = [w for w in words if len(w) > 4 and w.isalpha()]
            if not important_words:
                important_words = [w for w in words if len(w) > 3 and w.isalpha()]
            
            if important_words:
                # Select a random important word
                target_word = random.choice(important_words)
                cloze_text = text.replace(target_word, "______", 1)
                
                return {
                    "type": "cloze",
                    "question": cloze_text,
                    "answer": target_word,
                    "source_text": text
                }
        except Exception:
            pass
        
        return None
    
    def generate_definition_card(self, text: str) -> Dict[str, Any]:
        """
        Generate a definition-style flashcard.
        """
        try:
            # Generate a summary/definition
            definition_prompt = f"summarize: {text}"
            definition_inputs = self.tokenizer.encode(definition_prompt, return_tensors="pt", max_length=512, truncation=True)
            definition_outputs = self.model.generate(
                definition_inputs,
                max_length=80,
                num_return_sequences=1,
                temperature=0.5,
                do_sample=True,
                pad_token_id=self.tokenizer.eos_token_id
            )
            definition = self.tokenizer.decode(definition_outputs[0], skip_special_tokens=True)
            
            # Clean up the definition
            if definition.startswith("summarize:"):
                definition = definition[10:].strip()
            
            return {
                "type": "definition",
                "question": f"Define or explain: {definition}",
                "answer": text,
                "source_text": text
            }
        except Exception as e:
            return {
                "type": "definition",
                "question": "Explain the concept described in this text:",
                "answer": text,
                "source_text": text
            }
    
    def generate_flashcards(self, text: str) -> List[Dict[str, Any]]:
        """
        Generate multiple types of flashcards from input text.
        """
        if not text or len(text.strip()) < 10:
            return []
        
        # Preprocess text into chunks
        chunks = self.preprocess_text(text)
        
        if not chunks:
            return []
        
        flashcards = []
        
        for chunk in chunks:
            # Generate Q&A card (primary type)
            qa_card = self.generate_qa_card(chunk)
            if qa_card:
                flashcards.append(qa_card)
            
            # Occasionally generate other types
            if len(chunk.split()) > 10 and random.random() < 0.3:
                cloze_card = self.generate_cloze_card(chunk)
                if cloze_card:
                    flashcards.append(cloze_card)
            
            if len(chunk.split()) > 15 and random.random() < 0.2:
                def_card = self.generate_definition_card(chunk)
                if def_card:
                    flashcards.append(def_card)
        
        # Limit total cards and add metadata
        flashcards = flashcards[:15]  # Max 15 cards per document
        
        for i, card in enumerate(flashcards):
            card["id"] = f"card_{i+1}"
            card["difficulty"] = 0  # Initial difficulty
            card["created_at"] = "server_timestamp"
        
        return flashcards
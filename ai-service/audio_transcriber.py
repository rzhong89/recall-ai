import os
import tempfile
import logging
from typing import Dict, Any, Optional, List
import whisper
from pydub import AudioSegment
import ffmpeg
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

class AudioTranscriber:
    def __init__(self, model_size: str = "base"):
        """
        Initialize Whisper audio transcriber
        
        Args:
            model_size: Whisper model size ('tiny', 'base', 'small', 'medium', 'large')
        """
        self.model_size = model_size
        self.model = None
        self.supported_formats = ['.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.wma']
        
        # Load model lazily
        self._load_model()
    
    def _load_model(self):
        """Load Whisper model"""
        try:
            logger.info(f"Loading Whisper model: {self.model_size}")
            self.model = whisper.load_model(self.model_size)
            logger.info("Whisper model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load Whisper model: {e}")
            raise

    def is_supported_format(self, file_path: str) -> bool:
        """Check if audio format is supported"""
        _, ext = os.path.splitext(file_path.lower())
        return ext in self.supported_formats

    def convert_audio_format(self, input_path: str, output_path: str = None) -> str:
        """
        Convert audio to WAV format for Whisper processing
        
        Args:
            input_path: Path to input audio file
            output_path: Path for output WAV file (optional)
            
        Returns:
            Path to converted WAV file
        """
        try:
            if output_path is None:
                output_path = tempfile.mktemp(suffix='.wav')
            
            logger.info(f"Converting audio from {input_path} to {output_path}")
            
            # Use pydub for conversion
            audio = AudioSegment.from_file(input_path)
            
            # Convert to WAV with optimal settings for Whisper
            audio = audio.set_frame_rate(16000)  # Whisper prefers 16kHz
            audio = audio.set_channels(1)        # Mono
            audio.export(output_path, format="wav")
            
            logger.info("Audio conversion completed")
            return output_path
            
        except Exception as e:
            logger.error(f"Audio conversion failed: {e}")
            raise

    def segment_long_audio(self, audio_path: str, max_duration_minutes: int = 30) -> List[str]:
        """
        Split long audio files into smaller segments for processing
        
        Args:
            audio_path: Path to audio file
            max_duration_minutes: Maximum duration per segment in minutes
            
        Returns:
            List of paths to audio segments
        """
        try:
            audio = AudioSegment.from_file(audio_path)
            duration_ms = len(audio)
            max_duration_ms = max_duration_minutes * 60 * 1000
            
            if duration_ms <= max_duration_ms:
                return [audio_path]
            
            segments = []
            segment_count = (duration_ms // max_duration_ms) + 1
            
            logger.info(f"Splitting audio into {segment_count} segments")
            
            for i in range(segment_count):
                start_ms = i * max_duration_ms
                end_ms = min((i + 1) * max_duration_ms, duration_ms)
                
                segment = audio[start_ms:end_ms]
                segment_path = tempfile.mktemp(suffix=f'_segment_{i}.wav')
                segment.export(segment_path, format="wav")
                segments.append(segment_path)
            
            return segments
            
        except Exception as e:
            logger.error(f"Audio segmentation failed: {e}")
            raise

    def transcribe_audio(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe audio file using Whisper
        
        Args:
            audio_path: Path to audio file
            language: Language code (optional, auto-detect if None)
            
        Returns:
            Transcription result with text and metadata
        """
        try:
            if not self.model:
                self._load_model()
            
            if not os.path.exists(audio_path):
                raise FileNotFoundError(f"Audio file not found: {audio_path}")
            
            logger.info(f"Starting transcription of {audio_path}")
            
            # Convert to WAV if needed
            converted_path = None
            if not audio_path.lower().endswith('.wav'):
                converted_path = self.convert_audio_format(audio_path)
                transcribe_path = converted_path
            else:
                transcribe_path = audio_path
            
            # Transcribe
            result = self.model.transcribe(
                transcribe_path,
                language=language,
                verbose=False,
                word_timestamps=True
            )
            
            # Clean up converted file
            if converted_path and os.path.exists(converted_path):
                os.unlink(converted_path)
            
            # Process result
            transcription_result = {
                "text": result["text"].strip(),
                "language": result["language"],
                "segments": [],
                "duration": 0
            }
            
            # Process segments with timestamps
            for segment in result["segments"]:
                segment_data = {
                    "start": segment["start"],
                    "end": segment["end"],
                    "text": segment["text"].strip(),
                    "words": []
                }
                
                # Add word-level timestamps if available
                if "words" in segment:
                    for word in segment["words"]:
                        word_data = {
                            "word": word["word"],
                            "start": word["start"],
                            "end": word["end"]
                        }
                        segment_data["words"].append(word_data)
                
                transcription_result["segments"].append(segment_data)
            
            # Calculate total duration
            if transcription_result["segments"]:
                transcription_result["duration"] = transcription_result["segments"][-1]["end"]
            
            logger.info(f"Transcription completed. Text length: {len(transcription_result['text'])} chars")
            
            return transcription_result
            
        except Exception as e:
            logger.error(f"Transcription failed: {e}")
            raise

    def transcribe_long_audio(self, audio_path: str, language: Optional[str] = None) -> Dict[str, Any]:
        """
        Transcribe long audio files by segmenting them
        
        Args:
            audio_path: Path to audio file
            language: Language code (optional)
            
        Returns:
            Combined transcription result
        """
        try:
            # Check audio duration
            audio = AudioSegment.from_file(audio_path)
            duration_minutes = len(audio) / (1000 * 60)
            
            logger.info(f"Audio duration: {duration_minutes:.1f} minutes")
            
            if duration_minutes <= 30:  # Process directly if under 30 minutes
                return self.transcribe_audio(audio_path, language)
            
            # Segment and transcribe
            segments = self.segment_long_audio(audio_path, max_duration_minutes=25)
            
            combined_result = {
                "text": "",
                "language": None,
                "segments": [],
                "duration": 0
            }
            
            time_offset = 0
            
            for i, segment_path in enumerate(segments):
                logger.info(f"Transcribing segment {i+1}/{len(segments)}")
                
                try:
                    segment_result = self.transcribe_audio(segment_path, language)
                    
                    # Set language from first segment
                    if combined_result["language"] is None:
                        combined_result["language"] = segment_result["language"]
                    
                    # Append text
                    if combined_result["text"]:
                        combined_result["text"] += " "
                    combined_result["text"] += segment_result["text"]
                    
                    # Adjust timestamps and append segments
                    for seg in segment_result["segments"]:
                        adjusted_segment = {
                            "start": seg["start"] + time_offset,
                            "end": seg["end"] + time_offset,
                            "text": seg["text"],
                            "words": []
                        }
                        
                        # Adjust word timestamps
                        for word in seg.get("words", []):
                            adjusted_word = {
                                "word": word["word"],
                                "start": word["start"] + time_offset,
                                "end": word["end"] + time_offset
                            }
                            adjusted_segment["words"].append(adjusted_word)
                        
                        combined_result["segments"].append(adjusted_segment)
                    
                    # Update time offset
                    time_offset += segment_result["duration"]
                    
                finally:
                    # Clean up segment file
                    if os.path.exists(segment_path):
                        os.unlink(segment_path)
            
            combined_result["duration"] = time_offset
            
            logger.info(f"Long audio transcription completed. Total duration: {time_offset:.1f} seconds")
            
            return combined_result
            
        except Exception as e:
            logger.error(f"Long audio transcription failed: {e}")
            raise

    def get_audio_info(self, audio_path: str) -> Dict[str, Any]:
        """
        Get audio file information
        
        Args:
            audio_path: Path to audio file
            
        Returns:
            Audio file metadata
        """
        try:
            audio = AudioSegment.from_file(audio_path)
            
            return {
                "duration_seconds": len(audio) / 1000,
                "duration_minutes": len(audio) / (1000 * 60),
                "channels": audio.channels,
                "frame_rate": audio.frame_rate,
                "sample_width": audio.sample_width,
                "format": os.path.splitext(audio_path)[1].lower(),
                "file_size_mb": os.path.getsize(audio_path) / (1024 * 1024)
            }
            
        except Exception as e:
            logger.error(f"Failed to get audio info: {e}")
            return {}

    def health_check(self) -> Dict[str, Any]:
        """
        Check if Whisper model is loaded and working
        """
        try:
            if not self.model:
                return {
                    "status": "unhealthy",
                    "model": f"whisper-{self.model_size}",
                    "loaded": False,
                    "error": "Model not loaded"
                }
            
            return {
                "status": "healthy",
                "model": f"whisper-{self.model_size}",
                "loaded": True,
                "supported_formats": self.supported_formats
            }
            
        except Exception as e:
            return {
                "status": "unhealthy",
                "model": f"whisper-{self.model_size}",
                "loaded": False,
                "error": str(e)
            }
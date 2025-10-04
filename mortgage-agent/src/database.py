"""
Database models and operations for conversation persistence.
Replaces in-memory storage to survive server restarts.
"""

import json
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.ext.asyncio import async_sessionmaker
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Database configuration
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./conversations.db")

# For async operations, we need to use the correct async driver
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql+asyncpg://")
elif DATABASE_URL.startswith("postgresql://"):
    DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

# Create async engine
engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

Base = declarative_base()

class MortgageConversation(Base):
    """
    Model for storing mortgage conversation data persistently.
    Each conversation has an ID and stores the message history as JSON.
    """
    __tablename__ = "mortgage_conversations"
    
    id = Column(String, primary_key=True)  # conversation_id from frontend
    messages = Column(Text, nullable=False)  # JSON-encoded message history
    confirmed_entities = Column(Text, default='{}')  # JSON-encoded confirmed entity state
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def get_messages(self) -> List[Dict[str, str]]:
        """Parse JSON messages into list of dicts"""
        try:
            return json.loads(self.messages)
        except (json.JSONDecodeError, TypeError):
            return []
    
    def set_messages(self, messages: List[Dict[str, str]]):
        """Store messages as JSON string"""
        self.messages = json.dumps(messages)
        self.updated_at = datetime.utcnow()
    
    def get_confirmed_entities(self) -> Dict[str, Any]:
        """Parse JSON confirmed_entities into dict"""
        try:
            return json.loads(self.confirmed_entities)
        except (json.JSONDecodeError, TypeError):
            return {}
    
    def set_confirmed_entities(self, entities: Dict[str, Any]):
        """Store confirmed entities as JSON string"""
        self.confirmed_entities = json.dumps(entities)
        self.updated_at = datetime.utcnow()

async def init_database():
    """Initialize database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

async def get_conversation(conversation_id: str) -> Optional[List[Dict[str, str]]]:
    """
    Retrieve conversation messages by ID.
    Returns None if conversation not found.
    """
    async with async_session() as session:
        conversation = await session.get(MortgageConversation, conversation_id)
        if conversation:
            return conversation.get_messages()
        return None

async def get_conversation_with_entities(conversation_id: str) -> Optional[tuple[List[Dict[str, str]], Dict[str, Any]]]:
    """
    Retrieve conversation messages and confirmed entities by ID.
    Returns tuple of (messages, confirmed_entities) or None if conversation not found.
    """
    async with async_session() as session:
        conversation = await session.get(MortgageConversation, conversation_id)
        if conversation:
            return conversation.get_messages(), conversation.get_confirmed_entities()
        return None

async def save_conversation(conversation_id: str, messages: List[Dict[str, str]]):
    """
    Save or update conversation messages.
    Creates new conversation if it doesn't exist.
    """
    async with async_session() as session:
        conversation = await session.get(MortgageConversation, conversation_id)
        
        if conversation:
            # Update existing conversation
            conversation.set_messages(messages)
        else:
            # Create new conversation
            conversation = MortgageConversation(
                id=conversation_id,
                messages=json.dumps(messages),
                confirmed_entities='{}',
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(conversation)
        
        await session.commit()

async def save_conversation_with_entities(conversation_id: str, messages: List[Dict[str, str]], confirmed_entities: Dict[str, Any]):
    """
    Save or update conversation messages and confirmed entities.
    Creates new conversation if it doesn't exist.
    """
    async with async_session() as session:
        conversation = await session.get(MortgageConversation, conversation_id)
        
        if conversation:
            # Update existing conversation
            conversation.set_messages(messages)
            conversation.set_confirmed_entities(confirmed_entities)
        else:
            # Create new conversation
            conversation = MortgageConversation(
                id=conversation_id,
                messages=json.dumps(messages),
                confirmed_entities=json.dumps(confirmed_entities),
                created_at=datetime.utcnow(),
                updated_at=datetime.utcnow()
            )
            session.add(conversation)
        
        await session.commit()

async def delete_conversation(conversation_id: str) -> bool:
    """
    Delete a conversation by ID.
    Returns True if conversation was deleted, False if not found.
    """
    async with async_session() as session:
        conversation = await session.get(MortgageConversation, conversation_id)
        if conversation:
            await session.delete(conversation)
            await session.commit()
            return True
        return False

async def cleanup_old_conversations(max_age_hours: int = 24):
    """
    Clean up conversations older than max_age_hours.
    Default is 24 hours to prevent database bloat.
    """
    cutoff_time = datetime.utcnow() - timedelta(hours=max_age_hours)
    
    async with async_session() as session:
        # Note: This would need to be adjusted for the specific SQL dialect
        result = await session.execute(
            "DELETE FROM mortgage_conversations WHERE updated_at < :cutoff_time",
            {"cutoff_time": cutoff_time}
        )
        await session.commit()
        return result.rowcount

# In-memory fallback for backwards compatibility
_memory_conversations: Dict[str, List[Dict[str, str]]] = {}
_memory_entities: Dict[str, Dict[str, Any]] = {}

async def get_or_create_conversation(conversation_id: str) -> List[Dict[str, str]]:
    """
    Get conversation from database, with fallback to memory if database fails.
    Creates empty conversation if not found.
    """
    try:
        # Try database first
        messages = await get_conversation(conversation_id)
        if messages is not None:
            return messages
    except Exception as e:
        print(f"Database error in get_conversation: {e}")
        # Fall back to memory
        if conversation_id in _memory_conversations:
            return _memory_conversations[conversation_id]
    
    # Return empty conversation if not found anywhere
    return []

async def save_conversation_safe(conversation_id: str, messages: List[Dict[str, str]]):
    """
    Save conversation with fallback to memory if database fails.
    """
    try:
        # Try database first
        await save_conversation(conversation_id, messages)
    except Exception as e:
        print(f"Database error in save_conversation: {e}")
        # Fall back to memory
        _memory_conversations[conversation_id] = messages

async def get_or_create_conversation_with_entities(conversation_id: str) -> tuple[List[Dict[str, str]], Dict[str, Any]]:
    """
    Get conversation and confirmed entities from database, with fallback to memory if database fails.
    Creates empty conversation and entities if not found.
    """
    try:
        # Try database first
        result = await get_conversation_with_entities(conversation_id)
        if result is not None:
            return result
    except Exception as e:
        print(f"Database error in get_conversation_with_entities: {e}")
        # Fall back to memory
        if conversation_id in _memory_conversations:
            messages = _memory_conversations[conversation_id]
            entities = _memory_entities.get(conversation_id, {})
            return messages, entities
    
    # Return empty conversation and entities if not found anywhere
    return [], {}

async def save_conversation_with_entities_safe(conversation_id: str, messages: List[Dict[str, str]], confirmed_entities: Dict[str, Any]):
    """
    Save conversation and confirmed entities with fallback to memory if database fails.
    """
    try:
        # Try database first
        await save_conversation_with_entities(conversation_id, messages, confirmed_entities)
    except Exception as e:
        print(f"Database error in save_conversation_with_entities: {e}")
        # Fall back to memory
        _memory_conversations[conversation_id] = messages
        _memory_entities[conversation_id] = confirmed_entities
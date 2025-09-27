"""
Gmail integration for sending pre-qualification letters.
Uses Gmail API with OAuth2 authentication.
"""
import os
import base64
import logging
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional, Dict, Any

# Gmail API imports
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import pickle

logger = logging.getLogger(__name__)

# Gmail API scope for sending emails
SCOPES = ['https://www.googleapis.com/auth/gmail.send']


class GmailSender:
    """Handles Gmail authentication and email sending."""
    
    def __init__(self):
        """Initialize Gmail sender with credentials."""
        self.service = None
        self.sender_email = os.getenv('GMAIL_SENDER_EMAIL', 'noreply@mortgagepreapproval.com')
        self.credentials_path = os.getenv('GMAIL_CREDENTIALS_PATH', 'credentials.json')
        self.token_path = os.getenv('GMAIL_TOKEN_PATH', 'token.pickle')
        self._authenticate()
    
    def _authenticate(self):
        """Authenticate with Gmail API using OAuth2."""
        creds = None
        
        # Token file stores the user's access and refresh tokens
        if os.path.exists(self.token_path):
            with open(self.token_path, 'rb') as token:
                creds = pickle.load(token)
        
        # If there are no (valid) credentials available, let the user log in
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                if not os.path.exists(self.credentials_path):
                    logger.error(f"Gmail credentials file not found at {self.credentials_path}")
                    logger.info("Please set up OAuth2 credentials following the Gmail API quickstart guide")
                    return
                
                flow = InstalledAppFlow.from_client_secrets_file(
                    self.credentials_path, SCOPES)
                creds = flow.run_local_server(port=0)
            
            # Save the credentials for the next run
            with open(self.token_path, 'wb') as token:
                pickle.dump(creds, token)
        
        try:
            self.service = build('gmail', 'v1', credentials=creds)
            logger.info("Gmail authentication successful")
        except Exception as e:
            logger.error(f"Failed to build Gmail service: {e}")
    
    def send_email(self, to_email: str, subject: str, html_content: str, 
                   plain_content: Optional[str] = None) -> bool:
        """
        Send an email using Gmail API.
        
        Args:
            to_email: Recipient email address
            subject: Email subject
            html_content: HTML version of the email body
            plain_content: Plain text version (optional)
        
        Returns:
            True if sent successfully, False otherwise
        """
        if not self.service:
            logger.error("Gmail service not initialized")
            return False
        
        try:
            # Create message
            message = MIMEMultipart('alternative')
            message['to'] = to_email
            message['from'] = self.sender_email
            message['subject'] = subject
            
            # Add plain text part (fallback)
            if plain_content:
                text_part = MIMEText(plain_content, 'plain')
                message.attach(text_part)
            
            # Add HTML part
            html_part = MIMEText(html_content, 'html')
            message.attach(html_part)
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(
                message.as_string().encode('utf-8')
            ).decode('utf-8')
            
            # Send message
            send_message = {
                'raw': raw_message
            }
            
            result = self.service.users().messages().send(
                userId='me',
                body=send_message
            ).execute()
            
            logger.info(f"Email sent successfully to {to_email}. Message ID: {result['id']}")
            return True
            
        except HttpError as e:
            logger.error(f"Gmail API error: {e}")
            return False
        except Exception as e:
            logger.error(f"Failed to send email: {e}")
            return False


def send_prequalification_letter(
    recipient_email: str,
    recipient_name: str,
    loan_details: Dict[str, Any]
) -> bool:
    """
    Send a pre-qualification letter to the recipient.
    
    Args:
        recipient_email: Email address of the recipient
        recipient_name: Full name of the recipient
        loan_details: Dictionary containing loan information
    
    Returns:
        True if sent successfully, False otherwise
    """
    # Initialize Gmail sender
    sender = GmailSender()
    
    # Generate the letter content
    from .letter_generator import generate_prequalification_letter
    html_content, plain_content = generate_prequalification_letter(
        recipient_name, 
        loan_details
    )
    
    # Email subject
    subject = f"Your Mortgage Pre-Qualification Letter - {recipient_name}"
    
    # Send the email
    return sender.send_email(
        to_email=recipient_email,
        subject=subject,
        html_content=html_content,
        plain_content=plain_content
    )


# Simplified email sending for immediate use (without OAuth2)
def send_simple_email(to_email: str, subject: str, body: str) -> bool:
    """
    Simplified email sending using SMTP (for testing/fallback).
    This requires less setup but is less secure than OAuth2.
    """
    import smtplib
    from email.mime.text import MIMEText
    
    # Get SMTP settings from environment
    smtp_host = os.getenv('SMTP_HOST', 'smtp.gmail.com')
    smtp_port = int(os.getenv('SMTP_PORT', '587'))
    smtp_user = os.getenv('SMTP_USER', '')
    smtp_password = os.getenv('SMTP_PASSWORD', '')
    
    if not smtp_user or not smtp_password:
        logger.warning("SMTP credentials not configured. Email not sent.")
        return False
    
    try:
        # Create message
        msg = MIMEText(body, 'html')
        msg['Subject'] = subject
        msg['From'] = smtp_user
        msg['To'] = to_email
        
        # Send email
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        logger.info(f"Email sent successfully to {to_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        return False
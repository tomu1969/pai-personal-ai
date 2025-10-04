"""
Gmail OAuth2 Setup Script
This script helps you set up Gmail API credentials for sending pre-qualification letters.

Prerequisites:
1. Go to https://console.cloud.google.com/
2. Create a new project or select an existing one
3. Enable Gmail API for your project
4. Create OAuth 2.0 credentials (Desktop application type)
5. Download the credentials JSON file
"""

import os
import json
import pickle
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def setup_gmail_oauth():
    """Set up Gmail OAuth2 credentials."""
    
    print("=" * 60)
    print("Gmail API Setup for Mortgage Pre-Qualification Letters")
    print("=" * 60)
    print()
    
    # Check for credentials file
    creds_path = input("Enter path to your OAuth2 credentials JSON file (downloaded from Google Cloud Console): ").strip()
    
    if not os.path.exists(creds_path):
        print(f"Error: File not found at {creds_path}")
        return False
    
    # Copy credentials to project directory
    target_creds = "credentials.json"
    with open(creds_path, 'r') as source:
        creds_data = json.load(source)
    
    with open(target_creds, 'w') as target:
        json.dump(creds_data, target, indent=2)
    
    print(f"✓ Credentials saved to {target_creds}")
    
    # Perform OAuth2 flow
    print("\nStarting OAuth2 authentication...")
    print("A browser window will open for you to authorize access to Gmail.")
    print("Please sign in with the Gmail account you want to use for sending letters.")
    
    flow = InstalledAppFlow.from_client_secrets_file(
        target_creds, SCOPES)
    creds = flow.run_local_server(port=0)
    
    # Save the token
    token_path = "token.pickle"
    with open(token_path, 'wb') as token:
        pickle.dump(creds, token)
    
    print(f"✓ Authentication successful! Token saved to {token_path}")
    
    # Get sender email
    sender_email = input("\nEnter the email address to use as sender (press Enter to use authenticated account): ").strip()
    
    # Create .env entries
    print("\n" + "=" * 60)
    print("Add these lines to your .env file:")
    print("=" * 60)
    print()
    print("# Gmail API Configuration")
    print(f"GMAIL_CREDENTIALS_PATH=credentials.json")
    print(f"GMAIL_TOKEN_PATH=token.pickle")
    if sender_email:
        print(f"GMAIL_SENDER_EMAIL={sender_email}")
    print()
    print("# Company Information for Letters")
    print("COMPANY_NAME=Premier Mortgage Services")
    print("COMPANY_PHONE=1-800-MORTGAGE")
    print("COMPANY_EMAIL=info@premiermortgage.com")
    print("LOAN_OFFICER_NAME=John Smith")
    print("NMLS_NUMBER=123456")
    print("LETTER_EXPIRY_DAYS=90")
    print()
    print("# Fallback SMTP Configuration (optional)")
    print("SMTP_HOST=smtp.gmail.com")
    print("SMTP_PORT=587")
    print("SMTP_USER=your-email@gmail.com")
    print("SMTP_PASSWORD=your-app-password")
    print()
    print("=" * 60)
    
    # Update .gitignore
    gitignore_path = Path(".gitignore")
    gitignore_entries = [
        "credentials.json",
        "token.pickle",
        "*.pickle"
    ]
    
    if gitignore_path.exists():
        with open(gitignore_path, 'r') as f:
            existing = f.read()
    else:
        existing = ""
    
    entries_to_add = []
    for entry in gitignore_entries:
        if entry not in existing:
            entries_to_add.append(entry)
    
    if entries_to_add:
        with open(gitignore_path, 'a') as f:
            if not existing.endswith('\n') and existing:
                f.write('\n')
            f.write('\n# Gmail OAuth2 credentials\n')
            for entry in entries_to_add:
                f.write(f"{entry}\n")
        print(f"✓ Updated .gitignore with credential file exclusions")
    
    print("\n✅ Gmail setup complete!")
    print("You can now send pre-qualification letters via Gmail API.")
    print("\nNext steps:")
    print("1. Update your .env file with the configuration above")
    print("2. Test the email sending with: python test_email.py")
    
    return True


if __name__ == "__main__":
    try:
        success = setup_gmail_oauth()
        if not success:
            print("\n❌ Setup failed. Please check the instructions and try again.")
    except ImportError as e:
        print("\n❌ Missing required packages. Please install:")
        print("pip install google-auth google-auth-oauthlib google-auth-httplib2 google-api-python-client")
    except Exception as e:
        print(f"\n❌ Error during setup: {e}")
        print("Please check the instructions at https://developers.google.com/gmail/api/quickstart/python")
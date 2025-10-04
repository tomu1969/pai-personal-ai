"""
Test script for pre-qualification letter email functionality.
"""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent))

from src.email_sender import send_prequalification_letter, send_simple_email
from src.letter_generator import generate_prequalification_letter


def test_letter_generation():
    """Test the letter generation without sending."""
    print("Testing letter generation...")
    
    test_details = {
        'property_price': 500000,
        'down_payment': 125000,
        'loan_amount': 375000,
        'property_city': 'Miami',
        'property_state': 'Florida',
        'loan_purpose': 'personal_home'
    }
    
    html_content, plain_content = generate_prequalification_letter(
        "John Doe",
        test_details
    )
    
    # Save to files for review
    with open("test_letter.html", "w") as f:
        f.write(html_content)
    
    with open("test_letter.txt", "w") as f:
        f.write(plain_content)
    
    print("✓ Letter generated successfully!")
    print("  - HTML version saved to: test_letter.html")
    print("  - Plain text version saved to: test_letter.txt")
    print()
    return True


def test_email_sending():
    """Test sending an actual email."""
    print("Testing email sending...")
    
    test_email = input("Enter email address to send test letter to: ").strip()
    if not test_email:
        print("No email provided. Skipping email test.")
        return False
    
    test_name = input("Enter recipient name (default: Test User): ").strip() or "Test User"
    
    test_details = {
        'property_price': 500000,
        'down_payment': 125000,
        'loan_amount': 375000,
        'property_city': 'Miami',
        'property_state': 'Florida',
        'loan_purpose': 'personal_home'
    }
    
    print(f"\nSending test letter to {test_email}...")
    
    # Try Gmail API first
    try:
        success = send_prequalification_letter(test_email, test_name, test_details)
        if success:
            print("✓ Email sent successfully via Gmail API!")
            return True
    except Exception as e:
        print(f"Gmail API failed: {e}")
        print("Trying SMTP fallback...")
    
    # Try SMTP fallback
    try:
        html_content, _ = generate_prequalification_letter(test_name, test_details)
        success = send_simple_email(
            test_email,
            f"TEST: Your Mortgage Pre-Qualification Letter - {test_name}",
            html_content
        )
        if success:
            print("✓ Email sent successfully via SMTP!")
            return True
        else:
            print("✗ SMTP sending failed. Check your SMTP configuration in .env")
            return False
    except Exception as e:
        print(f"✗ SMTP also failed: {e}")
        return False


def main():
    """Run all tests."""
    print("=" * 60)
    print("Pre-Qualification Letter Email System Test")
    print("=" * 60)
    print()
    
    # Test 1: Letter Generation
    if not test_letter_generation():
        print("Letter generation failed. Please check the error above.")
        return
    
    # Test 2: Email Sending
    print("Would you like to test actual email sending?")
    print("Note: This requires Gmail OAuth2 setup or SMTP credentials.")
    choice = input("Test email sending? (y/n): ").strip().lower()
    
    if choice == 'y':
        if not os.path.exists("credentials.json"):
            print("\n⚠️  Gmail credentials not found.")
            print("Run 'python setup_gmail.py' to set up Gmail OAuth2.")
            print("Or configure SMTP settings in your .env file.")
        
        test_email_sending()
    
    print("\n" + "=" * 60)
    print("Testing complete!")
    print("=" * 60)


if __name__ == "__main__":
    main()
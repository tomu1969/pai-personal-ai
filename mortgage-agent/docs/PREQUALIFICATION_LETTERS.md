# Pre-Qualification Letter System Documentation

## Overview

The mortgage agent now includes a professional pre-qualification letter generation and email delivery system. When a user is pre-approved, the agent:

1. **Informs them of their pre-qualified loan amount** (e.g., "$375,000")
2. **Offers to send a formal pre-qualification letter**
3. **Collects email and name if user accepts**
4. **Sends a professional HTML letter via Gmail API**

## Features

### 1. Standard Practice Compliance
The letters follow mortgage industry standards:
- Include loan amount, property location, down payment percentage
- Valid for 90 days (configurable)
- Contains required disclaimers about final approval
- **Excludes sensitive data** (no SSN, passport numbers, or specific income)

### 2. Professional HTML Template
- Clean, professional design
- Company branding
- Clear loan details section
- Important disclaimers highlighted
- Mobile-responsive layout

### 3. Gmail Integration
- Uses OAuth2 for secure authentication
- No passwords stored in code
- Fallback to SMTP if Gmail fails
- Rate limiting to prevent spam

## Setup Instructions

### Step 1: Install Gmail Dependencies
```bash
pip install -r requirements_gmail.txt
```

### Step 2: Set Up Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Gmail API:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"
4. Create OAuth2 Credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth client ID"
   - Choose "Desktop app" as application type
   - Download the credentials JSON file

### Step 3: Run Setup Script
```bash
python setup_gmail.py
```
Follow the prompts to:
- Provide path to downloaded credentials
- Authenticate with Gmail
- Configure sender settings

### Step 4: Update .env File
Add these environment variables:
```env
# Gmail API Configuration
GMAIL_CREDENTIALS_PATH=credentials.json
GMAIL_TOKEN_PATH=token.pickle
GMAIL_SENDER_EMAIL=loans@yourcompany.com

# Company Information
COMPANY_NAME=Your Mortgage Company
COMPANY_PHONE=1-800-YOUR-NUM
COMPANY_EMAIL=info@yourcompany.com
LOAN_OFFICER_NAME=Your Name
NMLS_NUMBER=123456
LETTER_EXPIRY_DAYS=90

# Optional SMTP Fallback
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=backup@yourcompany.com
SMTP_PASSWORD=app-specific-password
```

### Step 5: Test the System
```bash
python test_email.py
```

## Conversation Flow

### Example Interaction
```
Agent: Based on your information, you qualify for a loan of **$375,000** to purchase 
       your property in Miami, Florida.
       
       Would you like me to send you a formal pre-qualification letter? This official 
       document can be used when making offers on properties and shows sellers that 
       you're a serious, qualified buyer.

User: Yes please!

Agent: Perfect! To send you the pre-qualification letter, I'll need your email 
       address and full name. Could you please provide both?

User: John Smith, john.smith@email.com

Agent: Excellent! I've sent your pre-qualification letter to john.smith@email.com. 
       The letter includes your pre-qualified loan amount of $375,000 and is valid 
       for 90 days.
       
       A loan officer will also contact you within 24 hours to guide you through 
       the next steps. If you have any questions in the meantime, feel free to ask!
```

## Letter Contents

### Included Information
- Pre-qualified loan amount
- Property location (city, state)
- Property type/purpose
- Purchase price
- Down payment amount and percentage
- Loan-to-value ratio
- Validity period
- Loan officer contact details
- NMLS number

### Security & Privacy
- No Social Security Numbers
- No passport/visa numbers (only mentions requirement)
- No specific income amounts
- No bank account numbers
- No credit scores

### Legal Disclaimers
- Not a commitment to lend
- Subject to verification
- Rates subject to change
- Documentation requirements
- Property must meet guidelines

## Technical Implementation

### File Structure
```
src/
├── email_sender.py       # Gmail API integration
├── letter_generator.py   # HTML/text template generation
└── nodes.py             # Letter flow integration

setup_gmail.py           # OAuth2 setup script
test_email.py           # Testing utility
requirements_gmail.txt   # Gmail dependencies
```

### Key Functions

#### `send_prequalification_letter()`
Main function to send letters:
```python
success = send_prequalification_letter(
    recipient_email="user@example.com",
    recipient_name="John Doe",
    loan_details={
        'property_price': 500000,
        'down_payment': 125000,
        'loan_amount': 375000,
        'property_city': 'Miami',
        'property_state': 'Florida',
        'loan_purpose': 'personal_home'
    }
)
```

#### `handle_letter_request()`
Manages conversation flow for letter requests:
- Detects user acceptance/decline
- Extracts email and name from responses
- Sends letter when info complete
- Handles errors gracefully

## Troubleshooting

### Common Issues

1. **"Gmail credentials file not found"**
   - Run `python setup_gmail.py`
   - Download credentials from Google Cloud Console

2. **"Token expired"**
   - Delete `token.pickle`
   - Run setup script again to re-authenticate

3. **"Email not sending"**
   - Check internet connection
   - Verify Gmail API is enabled in Google Cloud
   - Try SMTP fallback configuration

4. **"Name extraction failing"**
   - Ask user to provide in format: "Name, email"
   - Implement more sophisticated NER if needed

## Testing

### Manual Testing
1. Run the mortgage agent
2. Complete all 8 questions
3. Get pre-approved
4. Accept letter offer
5. Provide email and name
6. Verify email received

### Automated Testing
```bash
# Test letter generation only
python -c "from src.letter_generator import generate_prequalification_letter; print('OK')"

# Test full email flow
python test_email.py
```

## Future Enhancements

1. **Multi-language letters** - Spanish, Portuguese versions
2. **PDF attachment** - Convert HTML to PDF
3. **Document upload links** - Include secure upload portal
4. **CRM integration** - Auto-create lead in CRM
5. **SMS delivery** - Send letter link via text
6. **Template customization** - Per-lender branding

## Compliance Notes

- Ensure NMLS number is current and valid
- Update disclaimers per state requirements
- Review with legal team before production use
- Maintain audit logs of all letters sent
- Implement retention policy for email records

## Support

For issues or questions:
1. Check this documentation
2. Review test output: `python test_email.py`
3. Check logs for detailed error messages
4. Verify all environment variables are set
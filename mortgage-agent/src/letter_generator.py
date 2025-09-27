"""
Pre-qualification letter generator with professional HTML templates.
Follows industry standards for content and privacy.
"""
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Tuple


def generate_prequalification_letter(
    recipient_name: str,
    loan_details: Dict[str, Any]
) -> Tuple[str, str]:
    """
    Generate HTML and plain text versions of the pre-qualification letter.
    
    Args:
        recipient_name: Full name of the recipient
        loan_details: Dictionary with loan information including:
            - property_price: Total property price
            - down_payment: Down payment amount
            - loan_amount: Pre-qualified loan amount
            - property_city: City of the property
            - property_state: State of the property
            - loan_purpose: personal_home, second_home, or investment_property
    
    Returns:
        Tuple of (html_content, plain_text_content)
    """
    # Calculate derived values
    down_payment_percentage = (loan_details['down_payment'] / loan_details['property_price']) * 100
    ltv_ratio = 100 - down_payment_percentage
    
    # Format dates
    today = datetime.now()
    expiry_days = int(os.getenv('LETTER_EXPIRY_DAYS', '90'))
    expiry_date = today + timedelta(days=expiry_days)
    
    # Format loan purpose
    loan_purpose_display = {
        'personal_home': 'Primary Residence',
        'second_home': 'Second Home',
        'investment_property': 'Investment Property'
    }.get(loan_details.get('loan_purpose', ''), 'Residential Property')
    
    # Company information
    company_name = os.getenv('COMPANY_NAME', 'Premier Mortgage Services')
    company_phone = os.getenv('COMPANY_PHONE', '1-800-MORTGAGE')
    company_email = os.getenv('COMPANY_EMAIL', 'info@premiermortgage.com')
    loan_officer = os.getenv('LOAN_OFFICER_NAME', 'John Smith')
    nmls_number = os.getenv('NMLS_NUMBER', '123456')
    
    # HTML version
    html_content = f"""
<!DOCTYPE html>
<html>
<head>
    <style>
        body {{
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }}
        .header {{
            text-align: center;
            border-bottom: 2px solid #0066cc;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #0066cc;
            margin: 0;
        }}
        .letter-date {{
            text-align: right;
            color: #666;
            margin-bottom: 20px;
        }}
        .loan-details {{
            background-color: #f5f5f5;
            padding: 20px;
            border-radius: 5px;
            margin: 20px 0;
        }}
        .loan-details h2 {{
            color: #0066cc;
            margin-top: 0;
        }}
        .detail-row {{
            display: flex;
            justify-content: space-between;
            margin: 10px 0;
            padding: 5px 0;
            border-bottom: 1px dotted #ccc;
        }}
        .detail-label {{
            font-weight: bold;
        }}
        .detail-value {{
            color: #0066cc;
        }}
        .disclaimer {{
            background-color: #fff3cd;
            border: 1px solid #ffc107;
            padding: 15px;
            margin-top: 30px;
            border-radius: 5px;
        }}
        .disclaimer h3 {{
            color: #856404;
            margin-top: 0;
        }}
        .footer {{
            margin-top: 40px;
            text-align: center;
            color: #666;
            font-size: 0.9em;
        }}
        .signature {{
            margin-top: 40px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>{company_name}</h1>
        <p>Foreign Nationals Loan Program</p>
    </div>
    
    <div class="letter-date">
        {today.strftime('%B %d, %Y')}
    </div>
    
    <p>Dear {recipient_name},</p>
    
    <p>Congratulations! Based on the information you have provided, you are <strong>PRE-QUALIFIED</strong> 
    for a mortgage loan through our Foreign Nationals Loan Program.</p>
    
    <div class="loan-details">
        <h2>Pre-Qualification Summary</h2>
        
        <div class="detail-row">
            <span class="detail-label">Pre-Qualified Loan Amount:</span>
            <span class="detail-value">${loan_details['loan_amount']:,.2f}</span>
        </div>
        
        <div class="detail-row">
            <span class="detail-label">Property Location:</span>
            <span class="detail-value">{loan_details.get('property_city', '')}, {loan_details.get('property_state', '')}</span>
        </div>
        
        <div class="detail-row">
            <span class="detail-label">Property Type:</span>
            <span class="detail-value">{loan_purpose_display}</span>
        </div>
        
        <div class="detail-row">
            <span class="detail-label">Purchase Price:</span>
            <span class="detail-value">${loan_details['property_price']:,.2f}</span>
        </div>
        
        <div class="detail-row">
            <span class="detail-label">Down Payment:</span>
            <span class="detail-value">${loan_details['down_payment']:,.2f} ({down_payment_percentage:.1f}%)</span>
        </div>
        
        <div class="detail-row">
            <span class="detail-label">Loan-to-Value Ratio:</span>
            <span class="detail-value">{ltv_ratio:.1f}%</span>
        </div>
        
        <div class="detail-row">
            <span class="detail-label">Pre-Qualification Valid Until:</span>
            <span class="detail-value">{expiry_date.strftime('%B %d, %Y')}</span>
        </div>
    </div>
    
    <p>This pre-qualification letter indicates that you meet the initial criteria for our Foreign Nationals 
    Loan Program based on the information you have provided. You may use this letter when making an offer 
    on a property.</p>
    
    <div class="disclaimer">
        <h3>Important Disclaimers</h3>
        <ul>
            <li>This is a pre-qualification letter, not a commitment to lend.</li>
            <li>Final loan approval is subject to verification of all information provided, including but not 
                limited to: income verification, asset verification, property appraisal, and title review.</li>
            <li>Interest rates and loan terms are subject to change based on market conditions and final 
                underwriting.</li>
            <li>Additional documentation will be required, including valid passport, visa documentation, 
                proof of income, and proof of reserves.</li>
            <li>This pre-qualification is valid for {expiry_days} days from the date of this letter.</li>
            <li>Property must meet all lending guidelines and appraisal requirements.</li>
        </ul>
    </div>
    
    <div class="signature">
        <p>Should you have any questions or wish to proceed with a formal application, please contact me directly.</p>
        
        <p>Sincerely,</p>
        
        <p style="margin-top: 30px;">
            <strong>{loan_officer}</strong><br>
            Senior Loan Officer<br>
            NMLS# {nmls_number}<br>
            {company_name}<br>
            Phone: {company_phone}<br>
            Email: {company_email}
        </p>
    </div>
    
    <div class="footer">
        <p>{company_name} is an Equal Housing Lender. This letter is confidential and intended 
        solely for the use of the addressee.</p>
    </div>
</body>
</html>
"""
    
    # Plain text version
    plain_content = f"""
{company_name}
Foreign Nationals Loan Program

{today.strftime('%B %d, %Y')}

Dear {recipient_name},

Congratulations! Based on the information you have provided, you are PRE-QUALIFIED for a mortgage loan through our Foreign Nationals Loan Program.

PRE-QUALIFICATION SUMMARY
-------------------------
Pre-Qualified Loan Amount: ${loan_details['loan_amount']:,.2f}
Property Location: {loan_details.get('property_city', '')}, {loan_details.get('property_state', '')}
Property Type: {loan_purpose_display}
Purchase Price: ${loan_details['property_price']:,.2f}
Down Payment: ${loan_details['down_payment']:,.2f} ({down_payment_percentage:.1f}%)
Loan-to-Value Ratio: {ltv_ratio:.1f}%
Pre-Qualification Valid Until: {expiry_date.strftime('%B %d, %Y')}

This pre-qualification letter indicates that you meet the initial criteria for our Foreign Nationals Loan Program based on the information you have provided. You may use this letter when making an offer on a property.

IMPORTANT DISCLAIMERS:
- This is a pre-qualification letter, not a commitment to lend.
- Final loan approval is subject to verification of all information provided.
- Interest rates and loan terms are subject to change.
- Additional documentation will be required.
- This pre-qualification is valid for {expiry_days} days from the date of this letter.
- Property must meet all lending guidelines and appraisal requirements.

Should you have any questions or wish to proceed with a formal application, please contact me directly.

Sincerely,

{loan_officer}
Senior Loan Officer
NMLS# {nmls_number}
{company_name}
Phone: {company_phone}
Email: {company_email}

{company_name} is an Equal Housing Lender.
"""
    
    return html_content, plain_content
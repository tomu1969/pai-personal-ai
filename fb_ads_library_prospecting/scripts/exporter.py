import json
import ast
from pathlib import Path
import pandas as pd


def parse_list_field(value):
    if isinstance(value, list):
        return value
    if value is None or (isinstance(value, float) and pd.isna(value)) or value == '':
        return []
    try:
        return ast.literal_eval(value)
    except (ValueError, SyntaxError):
        return [value] if value else []


def export_csv(df: pd.DataFrame, output_dir: Path) -> Path:
    output_path = output_dir / 'prospects_final.csv'
    df.to_csv(output_path, index=False, encoding='utf-8')
    return output_path


def export_excel(df: pd.DataFrame, output_dir: Path) -> Path:
    output_path = output_dir / 'prospects_final.xlsx'

    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Prospects')

        worksheet = writer.sheets['Prospects']
        for idx, col in enumerate(df.columns, 1):
            max_len = max(
                df[col].astype(str).str.len().max(),
                len(col)
            )
            worksheet.column_dimensions[chr(64 + idx) if idx <= 26 else 'A'].width = min(max_len + 2, 50)

    return output_path


def safe_str(value, default=''):
    """Convert value to string, handling NaN and None."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return default
    return str(value)


def export_email_json(df: pd.DataFrame, output_dir: Path) -> Path:
    output_path = output_dir / 'email_drafts.json'

    email_records = []
    for _, row in df.iterrows():
        if pd.notna(row.get('email_body')) and row.get('email_body'):
            record = {
                'page_name': safe_str(row.get('page_name', '')),
                'contact_name': safe_str(row.get('contact_name', '')),
                'contact_position': safe_str(row.get('contact_position', '')),
                'primary_email': safe_str(row.get('primary_email', '')),
                'emails': parse_list_field(row.get('emails', [])),
                'hunter_emails': parse_list_field(row.get('hunter_emails', [])),
                'email_verified': safe_str(row.get('email_verified', '')),
                'ad_count': int(row.get('ad_count', 0)) if pd.notna(row.get('ad_count')) else 0,
                'platforms': safe_str(row.get('platforms', '')),
                'email_subject': safe_str(row.get('email_subject', '')),
                'email_body': safe_str(row.get('email_body', '')),
                'personalization_points': parse_list_field(row.get('personalization_points', []))
            }
            email_records.append(record)

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(email_records, f, indent=2, ensure_ascii=False)

    return output_path


def generate_summary_report(df: pd.DataFrame, output_paths: dict) -> None:
    total = len(df)
    with_emails = df['emails'].apply(lambda x: bool(parse_list_field(x))).sum() if 'emails' in df.columns else 0
    with_contact = df['contact_name'].notna().sum() if 'contact_name' in df.columns else 0
    with_drafts = df['email_body'].notna().sum() if 'email_body' in df.columns else 0

    print("\n" + "=" * 50)
    print("PIPELINE SUMMARY REPORT")
    print("=" * 50)
    print(f"Total prospects processed:     {total}")
    print(f"Prospects with valid emails:   {with_emails} ({100*with_emails/total:.1f}%)" if total else "")
    print(f"Prospects with contact names:  {with_contact} ({100*with_contact/total:.1f}%)" if total else "")
    print(f"Prospects with email drafts:   {with_drafts} ({100*with_drafts/total:.1f}%)" if total else "")
    print("-" * 50)
    print("Output files:")
    for name, path in output_paths.items():
        print(f"  {name}: {path}")
    print("=" * 50 + "\n")


def export_all(df: pd.DataFrame, output_dir: str = 'output') -> dict:
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    output_paths = {
        'CSV': export_csv(df, output_path),
        'Excel': export_excel(df, output_path),
        'JSON': export_email_json(df, output_path)
    }

    generate_summary_report(df, output_paths)

    return output_paths


if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent
    input_path = base_dir / 'processed' / '04_emails.csv'
    output_dir = base_dir / 'output'

    if input_path.exists():
        df = pd.read_csv(input_path, encoding='utf-8')
        export_all(df, str(output_dir))
    else:
        print(f"Input file not found: {input_path}")
        print("Run previous pipeline modules first.")

def build_extraction_prompt(field_descriptions: list[str]) -> str:
    fields_section = "\n".join(field_descriptions)
    return f"""Extract the following fields from this document image. Provide each field value as specified in the schema (string or number for numeric fields). Use null for fields not found or illegible.

Fields to extract:
{fields_section}"""

from fastapi import BackgroundTasks
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from google.cloud.firestore_v1 import Client as FirestoreClient

from app.services.task_dispatcher import get_task_dispatcher


def enqueue_extraction(
    db: FirestoreClient,
    case_id: str,
    source_document_id: str,
    user_id: str,
    background_tasks: BackgroundTasks,
) -> dict:
    case_ref = db.collection("cases").document(case_id)
    case_doc = case_ref.get()
    case_data = case_doc.to_dict()
    case_type_id = case_data["caseTypeId"]

    source_doc_ref = (
        db.collection("cases")
        .document(case_id)
        .collection("sourceDocuments")
        .document(source_document_id)
    )
    source_doc = source_doc_ref.get()
    if not source_doc.exists:
        raise ValueError("Source document not found")
    source_doc_data = source_doc.to_dict()
    source_document_type_id = source_doc_data["sourceDocumentTypeId"]

    auto_id = db.collection("extractions").document().id
    extraction_id = f"ext_{auto_id}"
    extraction_ref = db.collection("extractions").document(extraction_id)

    extraction_ref.set(
        {
            "extractionId": extraction_id,
            "caseId": case_id,
            "userId": user_id,
            "caseTypeId": case_type_id,
            "sourceDocumentTypeId": source_document_type_id,
            "caseSourceDocumentId": source_document_id,
            "version": 1,
            "status": "pending",
            "createdAt": SERVER_TIMESTAMP,
        }
    )

    dispatcher = get_task_dispatcher(background_tasks)
    dispatcher.dispatch_extraction(extraction_id)
    return {"extraction_id": extraction_id}

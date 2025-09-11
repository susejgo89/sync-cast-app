// utils/modals.js
const confirmModal = document.getElementById('confirm-modal');
const confirmModalTitle = document.getElementById('confirm-modal-title');
const confirmModalBody = document.getElementById('confirm-modal-body');
const confirmModalCancel = document.getElementById('confirm-modal-cancel');
const confirmModalConfirm = document.getElementById('confirm-modal-confirm');
let confirmCallback = null;

export function showConfirmModal(title, body, onConfirm) {
    confirmModalTitle.textContent = title;
    confirmModalBody.textContent = body;
    confirmCallback = onConfirm;
    confirmModal.classList.add('active');
}

confirmModalCancel.addEventListener('click', () => {
    confirmModal.classList.remove('active');
    confirmCallback = null;
});

confirmModalConfirm.addEventListener('click', () => {
    if (confirmCallback) {
        confirmCallback();
    }
    confirmModal.classList.remove('active');
    confirmCallback = null;
});
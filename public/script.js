document.addEventListener('DOMContentLoaded', function() {
    const flowList = document.getElementById('flowList');
    const addStepBtn = document.getElementById('addStepBtn');
    const removeStepBtn = document.getElementById('removeStepBtn');
    const moveUpBtn = document.getElementById('moveUpBtn');
    const moveDownBtn = document.getElementById('moveDownBtn');
    const saveBtn = document.getElementById('saveBtn');
    const stepNameInput = document.getElementById('stepName');
    const displayTextInput = document.getElementById('displayText');
    const systemPromptInput = document.getElementById('systemPrompt');

    let configData = { flow: [] };
    let selectedStepIndex = null;

    // Modal elements
    const modal = document.getElementById('modal');
    const modalTitle = document.getElementById('modalTitle');
    const modalMessage = document.getElementById('modalMessage');
    const modalOkBtn = document.getElementById('modalOkBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    // Fetch initial config data from backend
    fetch('/api/get_config')
        .then(response => {
            if (!response.ok) {
                // Handle HTTP errors
                return response.json().then(err => {
                    throw new Error(err.error || 'Error fetching configuration');
                });
            }
            return response.json();
        })
        .then(data => {
            configData = data;
            updateFlowList();
        })
        .catch(error => {
            showMessage('Error', 'Failed to load configuration: ' + error.message, 'error');
        });

    function updateFlowList() {
        flowList.innerHTML = '';
        configData.flow.forEach((step, index) => {
            const li = document.createElement('li');
            li.textContent = step.step;
            li.addEventListener('click', () => {
                selectStep(index);
            });
            if (index === selectedStepIndex) {
                li.classList.add('selected');
            }
            flowList.appendChild(li);
        });
    }

    function selectStep(index) {
        selectedStepIndex = index;
        updateFlowList();
        const step = configData.flow[index];
        stepNameInput.value = step.step || '';
        displayTextInput.value = step.display_text || '';
        systemPromptInput.value = step.system_prompt || '';
    }

    addStepBtn.addEventListener('click', () => {
        const stepName = prompt('Enter step name:');
        if (stepName && stepName.trim() !== '') {
            if (configData.flow.some(step => step.step === stepName.trim())) {
                showMessage('Validation Error', 'Step name must be unique.', 'warning');
                return;
            }
            const newStep = {
                step: stepName.trim(),
                display_text: '',
                system_prompt: ''
            };
            configData.flow.push(newStep);
            updateFlowList();
            selectStep(configData.flow.length - 1);
        }
    });

    removeStepBtn.addEventListener('click', () => {
        if (selectedStepIndex !== null) {
            showConfirmation(
                'Remove Step',
                `Are you sure you want to remove '${configData.flow[selectedStepIndex].step}'?`,
                () => {
                    configData.flow.splice(selectedStepIndex, 1);
                    selectedStepIndex = null;
                    updateFlowList();
                    clearInputs();
                }
            );
        } else {
            showMessage('No Selection', 'Please select a step to remove.', 'warning');
        }
    });

    moveUpBtn.addEventListener('click', () => {
        if (selectedStepIndex > 0) {
            const temp = configData.flow[selectedStepIndex];
            configData.flow[selectedStepIndex] = configData.flow[selectedStepIndex - 1];
            configData.flow[selectedStepIndex - 1] = temp;
            selectedStepIndex--;
            updateFlowList();
        }
    });

    moveDownBtn.addEventListener('click', () => {
        if (selectedStepIndex < configData.flow.length - 1) {
            const temp = configData.flow[selectedStepIndex];
            configData.flow[selectedStepIndex] = configData.flow[selectedStepIndex + 1];
            configData.flow[selectedStepIndex + 1] = temp;
            selectedStepIndex++;
            updateFlowList();
        }
    });

    saveBtn.addEventListener('click', () => {
        if (selectedStepIndex === null) {
            showMessage('No Selection', 'Please select a step to save.', 'warning');
            return;
        }
        const step = configData.flow[selectedStepIndex];
        const newName = stepNameInput.value.trim();
        if (!newName) {
            showMessage('Validation Error', 'Step name cannot be empty.', 'warning');
            return;
        }
        const otherSteps = configData.flow.filter((_, index) => index !== selectedStepIndex).map(s => s.step);
        if (otherSteps.includes(newName)) {
            showMessage('Validation Error', 'Step name must be unique.', 'warning');
            return;
        }
        step.step = newName;
        step.display_text = displayTextInput.value.trim();
        step.system_prompt = systemPromptInput.value.trim();

        // Send updated config to backend
        fetch('/api/save_config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        })
            .then(response => {
                if (!response.ok) {
                    // Handle HTTP errors
                    return response.json().then(err => {
                        throw new Error(err.error || 'Error saving configuration');
                    });
                }
                return response.json();
            })
            .then(data => {
                showMessage('Success', data.message || 'Changes saved successfully!', 'success');
                updateFlowList();
                selectStep(selectedStepIndex);
            })
            .catch(error => {
                showMessage('Save Error', 'Error saving config: ' + error.message, 'error');
            });
    });

    function clearInputs() {
        stepNameInput.value = '';
        displayTextInput.value = '';
        systemPromptInput.value = '';
    }

    function showMessage(title, message, type) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalOkBtn.textContent = 'OK';
        modalCancelBtn.style.display = 'none';
        modalOkBtn.classList.remove('danger-button');
        if (type === 'error' || type === 'warning') {
            modalOkBtn.classList.add('danger-button');
        }
        modal.style.display = 'block';
        modalOkBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    function showConfirmation(title, message, onConfirm) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalOkBtn.textContent = 'OK';
        modalCancelBtn.textContent = 'Cancel';
        modalCancelBtn.style.display = 'inline-block';
        modalOkBtn.classList.remove('danger-button');
        modalOkBtn.classList.add('danger-button');
        modal.style.display = 'block';
        modalOkBtn.onclick = () => {
            modal.style.display = 'none';
            onConfirm();
        };
        modalCancelBtn.onclick = () => {
            modal.style.display = 'none';
        };
    }

    // Close modal when clicking outside
    window.onclick = (event) => {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    };
});
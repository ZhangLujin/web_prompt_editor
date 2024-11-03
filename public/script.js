document.addEventListener('DOMContentLoaded', function () {
    let flowList = document.getElementById('flow-list');
    let stepNameInput = document.getElementById('step-name');
    let displayTextInput = document.getElementById('display-text');
    let systemPromptInput = document.getElementById('system-prompt');
    let addStepBtn = document.getElementById('add-step-btn');
    let removeStepBtn = document.getElementById('remove-step-btn');
    let moveUpBtn = document.getElementById('move-up-btn');
    let moveDownBtn = document.getElementById('move-down-btn');
    let saveBtn = document.getElementById('save-btn');

    let configData = {};
    let selectedStepIndex = null;

    // 获取配置数据
    function loadConfig() {
        fetch('/api/config')
            .then(response => response.json())
            .then(data => {
                configData = data;
                updateFlowList();
            })
            .catch(error => {
                showMessage('错误', '加载配置数据失败。');
                console.error('Error loading config:', error);
            });
    }

    function updateFlowList() {
        flowList.innerHTML = '';
        if (configData.flow && configData.flow.length > 0) {
            configData.flow.forEach((step, index) => {
                let li = document.createElement('li');
                li.textContent = step.step || '未命名步骤';
                li.dataset.index = index;
                li.addEventListener('click', function () {
                    selectStep(index);
                });
                flowList.appendChild(li);
            });
        }
    }

    function selectStep(index) {
        selectedStepIndex = index;
        let items = flowList.querySelectorAll('li');
        items.forEach((item, idx) => {
            if (idx === index) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        let step = configData.flow[index];
        stepNameInput.value = step.step || '';
        displayTextInput.value = step.display_text || '';
        systemPromptInput.value = step.system_prompt || '';
    }

    function addStep() {
        let name = prompt('请输入步骤名称:');
        if (name) {
            // 检查名称是否重复
            if (configData.flow.some(s => s.step === name)) {
                showMessage('验证错误', '步骤名称必须唯一。');
                return;
            }
            let newStep = {
                step: name,
                display_text: '',
                system_prompt: ''
            };
            configData.flow.push(newStep);
            updateFlowList();
            selectStep(configData.flow.length - 1);
        }
    }

    function removeStep() {
        if (selectedStepIndex !== null) {
            let confirmDelete = confirm(`确定要删除 '${configData.flow[selectedStepIndex].step}' 吗？`);
            if (confirmDelete) {
                configData.flow.splice(selectedStepIndex, 1);
                updateFlowList();
                selectedStepIndex = null;
                clearStepDetails();
            }
        } else {
            showMessage('未选择', '请选择要删除的步骤。');
        }
    }

    function moveStepUp() {
        if (selectedStepIndex > 0) {
            let temp = configData.flow[selectedStepIndex];
            configData.flow[selectedStepIndex] = configData.flow[selectedStepIndex - 1];
            configData.flow[selectedStepIndex - 1] = temp;
            updateFlowList();
            selectStep(selectedStepIndex - 1);
        }
    }

    function moveStepDown() {
        if (selectedStepIndex !== null && selectedStepIndex < configData.flow.length - 1) {
            let temp = configData.flow[selectedStepIndex];
            configData.flow[selectedStepIndex] = configData.flow[selectedStepIndex + 1];
            configData.flow[selectedStepIndex + 1] = temp;
            updateFlowList();
            selectStep(selectedStepIndex + 1);
        }
    }

    function clearStepDetails() {
        stepNameInput.value = '';
        displayTextInput.value = '';
        systemPromptInput.value = '';
    }

    function saveChanges() {
        if (selectedStepIndex !== null) {
            let newName = stepNameInput.value.trim();
            if (!newName) {
                showMessage('验证错误', '步骤名称不能为空。');
                return;
            }
            // 检查名称是否重复（排除当前步骤）
            let otherSteps = configData.flow.filter((_, idx) => idx !== selectedStepIndex);
            if (otherSteps.some(s => s.step === newName)) {
                showMessage('验证错误', '步骤名称必须唯一。');
                return;
            }

            let step = configData.flow[selectedStepIndex];
            step.step = newName;
            step.display_text = displayTextInput.value.trim();
            step.system_prompt = systemPromptInput.value.trim();

            // 保存到后端
            fetch('/api/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(configData)
            })
                .then(response => response.json())
                .then(data => {
                    if (data.message === 'Configuration updated successfully') {
                        showMessage('成功', '更改已成功保存！');
                        updateFlowList();
                        // 重新选择步骤（如果名称已更改）
                        selectedStepIndex = configData.flow.findIndex(s => s.step === newName);
                        selectStep(selectedStepIndex);
                    } else {
                        showMessage('错误', data.message);
                    }
                })
                .catch(error => {
                    showMessage('错误', '保存配置数据时出错。');
                    console.error('Error saving config:', error);
                });

        } else {
            showMessage('未选择', '请选择要保存的步骤。');
        }
    }

    function showMessage(title, message) {
        alert(`${title}\n\n${message}`);
    }

    addStepBtn.addEventListener('click', addStep);
    removeStepBtn.addEventListener('click', removeStep);
    moveUpBtn.addEventListener('click', moveStepUp);
    moveDownBtn.addEventListener('click', moveStepDown);
    saveBtn.addEventListener('click', saveChanges);

    // 初始化加载
    loadConfig();
});
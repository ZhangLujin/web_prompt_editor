document.addEventListener('DOMContentLoaded', function () {
    const flowList = document.getElementById('flowList');
    const stepNameInput = document.getElementById('stepName');
    const displayTextInput = document.getElementById('displayText');
    const systemPromptInput = document.getElementById('systemPrompt');

    const addStepBtn = document.getElementById('addStepBtn');
    const removeStepBtn = document.getElementById('removeStepBtn');
    const moveUpBtn = document.getElementById('moveUpBtn');
    const moveDownBtn = document.getElementById('moveDownBtn');
    const saveBtn = document.getElementById('saveBtn');

    let config = { flow: [] };
    let selectedStepIndex = null;

    // 加载配置
    function loadConfig() {
        fetch('/api/config')
            .then(response => response.json())
            .then(data => {
                config = data;
                updateFlowList();
            })
            .catch(error => {
                alert('Error loading config: ' + error);
            });
    }

    // 更新步骤列表
    function updateFlowList() {
        flowList.innerHTML = '';
        config.flow.forEach((step, index) => {
            const li = document.createElement('li');
            li.textContent = step.step;
            li.addEventListener('click', function () {
                selectStep(index);
            });
            if (index === selectedStepIndex) {
                li.classList.add('selected');
            }
            flowList.appendChild(li);
        });
    }

    // 选择步骤
    function selectStep(index) {
        selectedStepIndex = index;
        updateFlowList();
        const step = config.flow[index];
        stepNameInput.value = step.step;
        displayTextInput.value = step.display_text;
        systemPromptInput.value = step.system_prompt;
    }

    // 添加步骤
    addStepBtn.addEventListener('click', function () {
        const stepName = prompt('Enter step name:');
        if (stepName && stepName.trim()) {
            // 检查名称唯一
            if (config.flow.some(step => step.step === stepName.trim())) {
                alert('Step name must be unique.');
                return;
            }
            const newStep = {
                step: stepName.trim(),
                display_text: '',
                system_prompt: ''
            };
            config.flow.push(newStep);
            updateFlowList();
            selectStep(config.flow.length - 1);
        }
    });

    // 删除步骤
    removeStepBtn.addEventListener('click', function () {
        if (selectedStepIndex !== null) {
            const confirmDelete = confirm('Are you sure you want to remove "' + config.flow[selectedStepIndex].step + '"?');
            if (confirmDelete) {
                config.flow.splice(selectedStepIndex, 1);
                selectedStepIndex = null;
                updateFlowList();
                clearInputs();
            }
        } else {
            alert('Please select a step to remove.');
        }
    });

    // 上移步骤
    moveUpBtn.addEventListener('click', function () {
        if (selectedStepIndex > 0) {
            [config.flow[selectedStepIndex], config.flow[selectedStepIndex - 1]] =
                [config.flow[selectedStepIndex - 1], config.flow[selectedStepIndex]];
            selectedStepIndex--;
            updateFlowList();
        }
    });

    // 下移步骤
    moveDownBtn.addEventListener('click', function () {
        if (selectedStepIndex !== null && selectedStepIndex < config.flow.length - 1) {
            [config.flow[selectedStepIndex], config.flow[selectedStepIndex + 1]] =
                [config.flow[selectedStepIndex + 1], config.flow[selectedStepIndex]];
            selectedStepIndex++;
            updateFlowList();
        }
    });

    // 保存更改
    saveBtn.addEventListener('click', function () {
        if (selectedStepIndex === null) {
            alert('Please select a step to save.');
            return;
        }

        const newName = stepNameInput.value.trim();
        if (!newName) {
            alert('Step name cannot be empty.');
            return;
        }

        // 检查名称唯一（排除当前步骤）
        const otherSteps = config.flow.filter((step, index) => index !== selectedStepIndex);
        if (otherSteps.some(step => step.step === newName)) {
            alert('Step name must be unique.');
            return;
        }

        const step = config.flow[selectedStepIndex];
        step.step = newName;
        step.display_text = displayTextInput.value.trim();
        step.system_prompt = systemPromptInput.value.trim();

        // 保存到服务器
        fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(config)
        })
            .then(response => response.json())
            .then(data => {
                alert('Changes saved successfully!');
                loadConfig();
            })
            .catch(error => {
                alert('Error saving config: ' + error);
            });
    });

    // 清空输入框
    function clearInputs() {
        stepNameInput.value = '';
        displayTextInput.value = '';
        systemPromptInput.value = '';
    }

    // 初始化加载
    loadConfig();
});
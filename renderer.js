// renderer.js

const { ipcRenderer } = require('electron');
const fs = require('fs');

// 元素选择器
const loginDialog = document.getElementById('login-dialog');
const loginForm = document.getElementById('login-form');
const hostInput = document.getElementById('host-input');
const portInput = document.getElementById('port-input');
const passwordInput = document.getElementById('password-input');
const rememberCheckbox = document.getElementById('remember-checkbox');
const loginBtn = document.getElementById('login-btn');
const cancelLoginBtn = document.getElementById('cancel-login-btn');

const mainContent = document.getElementById('main-content');
const flowList = document.getElementById('flow-list');
const stepNameInput = document.getElementById('step-name');
const displayTextInput = document.getElementById('display-text');
const systemPromptInput = document.getElementById('system-prompt');
const addStepBtn = document.getElementById('add-step-btn');
const removeStepBtn = document.getElementById('remove-step-btn');
const moveUpBtn = document.getElementById('move-up-btn');
const moveDownBtn = document.getElementById('move-down-btn');
const saveBtn = document.getElementById('save-btn');
const renameFlowBtn = document.getElementById('rename-flow-btn');

const messageBox = document.getElementById('message-box');
const messageTitle = document.getElementById('message-title');
const messageText = document.getElementById('message-text');
const messageOkBtn = document.getElementById('message-ok-btn');
const messageCancelBtn = document.getElementById('message-cancel-btn');

// 添加以下元素选择器
const promptBox = document.getElementById('prompt-box');
const promptTitle = document.getElementById('prompt-title');
const promptText = document.getElementById('prompt-text');
const promptInput = document.getElementById('prompt-input');
const promptOkBtn = document.getElementById('prompt-ok-btn');
const promptCancelBtn = document.getElementById('prompt-cancel-btn');

// 新增流程管理元素选择器
const flowSelect = document.getElementById('flow-select');
const createFlowBtn = document.getElementById('create-flow-btn');
const deleteFlowBtn = document.getElementById('delete-flow-btn');
const setDefaultBtn = document.getElementById('set-default-btn');

// 添加导出和导入按钮的元素选择器
const exportJsonBtn = document.getElementById('export-json-btn');
const importJsonBtn = document.getElementById('import-json-btn');

// 目标网址
const urlLabel = document.getElementById('url-label');

// 添加新的元素选择器
const explanationsContainer = document.getElementById('explanations-container');
const explanationsList = document.getElementById('explanations-list');
const addExplanationBtn = document.getElementById('add-explanation-btn');
const explanationEditorModal = document.getElementById('explanation-editor-modal');
const explanationTitleInput = document.getElementById('explanation-title-input');
const explanationContentInput = document.getElementById('explanation-content-input');
const explanationCollapsedCheckbox = document.getElementById('explanation-collapsed-checkbox');
const explanationPreview = document.getElementById('explanation-preview');
const saveExplanationBtn = document.getElementById('save-explanation-btn');
const cancelExplanationBtn = document.getElementById('cancel-explanation-btn');

let config = { flow: [] };
let currentStepIndex = -1;
let currentFlowName = ''; // 当前流程名称
let defaultFlowName = ''; // 默认流程名称

// 撤销和重做栈
let undoStack = [];
let redoStack = [];

// 标记是否有未保存的更改
let hasUnsavedChanges = false;

// 定时器，用于处理输入时的延迟保存
let inputDelayTimer = null;

// 标记是否刚刚执行了撤销操作
let justUndone = false;

// 当前编辑的解释选项卡索引
let currentEditingExplanationIndex = -1;

// 添加一个函数来比较两个对象是否相等
function isEqual(obj1, obj2) {
  // 处理简单类型
  if (obj1 === obj2) return true;
  
  // 如果其中一个是null或undefined，另一个不是，则不相等
  if (obj1 == null || obj2 == null) return false;
  
  // 如果不是对象，则不相等
  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return false;
  
  // 处理数组
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    
    for (let i = 0; i < obj1.length; i++) {
      if (!isEqual(obj1[i], obj2[i])) return false;
    }
    
    return true;
  }
  
  // 处理普通对象
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  for (const key of keys1) {
    if (!keys2.includes(key)) return false;
    if (!isEqual(obj1[key], obj2[key])) return false;
  }
  
  return true;
}

// 添加一个变量来存储原始配置
let originalConfig = { flow: [] };

// 获取当前状态的深拷贝，扩展保存焦点信息和光标位置
function getState() {
    return {
        config: JSON.parse(JSON.stringify(config)),
        currentStepIndex: currentStepIndex,
        focusedField: getFocusedField(),
        cursorPosition: getCursorPosition()
    };
}

// 设置状态并更新界面，包括恢复焦点和光标位置
function setState(state) {
    config = JSON.parse(JSON.stringify(state.config));

    const prevStepIndex = currentStepIndex;
    currentStepIndex = state.currentStepIndex;

    updateFlowList();
    selectListItem(currentStepIndex);
    updatePromptView();

    // 如果步骤发生了变化，自动选中对应的步骤
    if (prevStepIndex !== currentStepIndex) {
        selectListItem(currentStepIndex);
    }

    // 恢复焦点和光标位置
    setFocusedField(state.focusedField, state.cursorPosition);
}

// 保存当前状态到撤销栈
function saveStateToUndoStack() {
    // 如果刚刚执行了撤销操作，并且现在进行了新操作，则需要清空 redoStack
    if (justUndone) {
        redoStack = [];
        justUndone = false;
    }

    undoStack.push(getState());
    
    // 检查是否有实际更改
    hasUnsavedChanges = checkUnsavedChanges();
}

// 获取当前焦点所在的输入框的标识
function getFocusedField() {
    if (document.activeElement === stepNameInput) {
        return 'stepName';
    } else if (document.activeElement === displayTextInput) {
        return 'displayText';
    } else if (document.activeElement === systemPromptInput) {
        return 'systemPrompt';
    } else {
        return null;
    }
}

// 获取当前光标位置
function getCursorPosition() {
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return document.activeElement.selectionStart || 0;
    }
    return 0;
}

// 设置焦点到指定的输入框，并恢复光标位置
function setFocusedField(fieldName, cursorPosition) {
    let field = null;
    switch (fieldName) {
        case 'stepName':
            field = stepNameInput;
            break;
        case 'displayText':
            field = displayTextInput;
            break;
        case 'systemPrompt':
            field = systemPromptInput;
            break;
        default:
            return;
    }
    field.focus();
    field.setSelectionRange(cursorPosition, cursorPosition);
}

// 显示消息框
function showMessage(title, message, type = 'info', hasCancel = false) {
    messageTitle.innerText = title;
    messageText.innerText = message;
    messageOkBtn.style.display = 'inline-block';
    messageCancelBtn.style.display = hasCancel ? 'inline-block' : 'none';

    return new Promise((resolve) => {
        messageBox.style.display = 'flex';

        messageOkBtn.onclick = () => {
            messageBox.style.display = 'none';
            resolve(true);
        };

        messageCancelBtn.onclick = () => {
            messageBox.style.display = 'none';
            resolve(false);
        };
    });
}

// 加载设置
function loadSettings() {
    const settings = localStorage.getItem('redis_settings');
    if (settings) {
        const parsed = JSON.parse(settings);
        if (parsed.remember) {
            hostInput.value = parsed.host || '';
            portInput.value = parsed.port || '';
            passwordInput.value = parsed.password || '';
            rememberCheckbox.checked = true;
        }
    }
}

// 保存设置
function saveSettings() {
    if (rememberCheckbox.checked) {
        const settings = {
            host: hostInput.value.trim(),
            port: portInput.value.trim(),
            password: passwordInput.value.trim(),
            remember: true
        };
        localStorage.setItem('redis_settings', JSON.stringify(settings));
    } else {
        localStorage.removeItem('redis_settings');
    }
}

// 初始化
function init() {
    loadSettings();

    // 登录表单提交事件
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const host = hostInput.value.trim();
        const port = portInput.value.trim();
        const password = passwordInput.value.trim();

        if (!host || !port) {
            showMessage('输入错误', '主机和端口不能为空。');
            return;
        }

        const portNum = parseInt(port);
        if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
            showMessage('输入错误', '端口必须是1到65535之间的数字。');
            return;
        }

        try {
            await ipcRenderer.invoke('connect-redis', host, portNum, password);
            saveSettings();
            loginDialog.style.display = 'none';
            mainContent.style.display = 'flex';
            await loadFlowList();
        } catch (error) {
            showMessage('Redis 连接错误', `无法连接到 Redis: ${error.message}`);
        }
    });

    // 登录取消按钮
    cancelLoginBtn.addEventListener('click', () => {
        window.close();
    });

    // 列表项点击事件
    flowList.addEventListener('click', async (e) => {
        if (e.target && e.target.nodeName === 'LI') {
            // 保存当前步骤的更改
            saveCurrentStepChanges();

            const items = flowList.getElementsByTagName('li');
            for (let i = 0; i < items.length; i++) {
                items[i].classList.remove('selected');
                if (items[i] === e.target) {
                    if (currentStepIndex !== i) {
                        // 如果步骤索引发生变化，保存状态到撤销栈
                        saveStateToUndoStack();
                        currentStepIndex = i;
                    }
                }
            }
            e.target.classList.add('selected');
            updatePromptView();
        }
    });

    // 添加步骤按钮
    addStepBtn.addEventListener('click', async () => {
        const stepName = await showPrompt('添加新步骤', '请输入步骤名称:');
        if (stepName) {
            if (config.flow.some(s => s.step === stepName)) {
                showMessage('验证错误', '步骤名称必须唯一。');
                return;
            }

            // 保存当前状态到撤销栈
            saveStateToUndoStack();

            config.flow.push({
                step: stepName,
                display_text: '',
                system_prompt: ''
            });
            currentStepIndex = config.flow.length - 1;
            updateFlowList();
            selectListItem(currentStepIndex);
            updatePromptView();
        }
    });

    // 删除步骤按钮
    removeStepBtn.addEventListener('click', async () => {
        if (currentStepIndex >= 0) {
            const confirm = await showMessage('移除步骤', `您确定要移除 '${config.flow[currentStepIndex].step}' 吗?`, 'question', true);
            if (confirm) {
                // 保存当前状态到撤销栈
                saveStateToUndoStack();

                config.flow.splice(currentStepIndex, 1);
                currentStepIndex = -1;
                updateFlowList();
                clearPromptView();
            }
        } else {
            showMessage('未选择', '请选择一个步骤进行移除。');
        }
    });

    // 上移按钮
    moveUpBtn.addEventListener('click', () => {
        if (currentStepIndex > 0) {
            // 保存当前状态到撤销栈
            saveStateToUndoStack();

            [config.flow[currentStepIndex], config.flow[currentStepIndex - 1]] = [config.flow[currentStepIndex - 1], config.flow[currentStepIndex]];
            currentStepIndex -= 1;
            updateFlowList();
            selectListItem(currentStepIndex);
        }
    });

    // 下移按钮
    moveDownBtn.addEventListener('click', () => {
        if (currentStepIndex >= 0 && currentStepIndex < config.flow.length - 1) {
            // 保存当前状态到撤销栈
            saveStateToUndoStack();

            [config.flow[currentStepIndex], config.flow[currentStepIndex + 1]] = [config.flow[currentStepIndex + 1], config.flow[currentStepIndex]];
            currentStepIndex += 1;
            updateFlowList();
            selectListItem(currentStepIndex);
        }
    });

    // 保存按钮
    saveBtn.addEventListener('click', async () => {
        // 保存当前步骤的更改
        saveCurrentStepChanges();

        // 验证所有步骤名称唯一
        const stepNames = config.flow.map(step => step.step);
        const uniqueStepNames = new Set(stepNames);
        if (stepNames.length !== uniqueStepNames.size) {
            showMessage('验证错误', '所有步骤名称必须唯一。');
            return;
        }

        try {
            await saveCurrentFlowConfig();
            showMessage('成功', '更改已成功保存！');
            hasUnsavedChanges = false;
            updateFlowList();
            selectListItem(currentStepIndex);
        } catch (error) {
            showMessage('保存错误', `保存配置时出错: ${error.message}`);
        }
    });

    // 输入框的 input 事件监听器，实时更新 config 中的数据
    function handleInputEvent() {
        if (currentStepIndex >= 0 && config.flow[currentStepIndex]) {
            // 清除输入延迟定时器
            clearTimeout(inputDelayTimer);
            inputDelayTimer = setTimeout(() => {
                // 获取当前值
                const currentStepName = stepNameInput.value.trim();
                const currentDisplayText = displayTextInput.value;
                const currentSystemPrompt = systemPromptInput.value;
                
                // 检查是否有实际更改
                const currentStep = config.flow[currentStepIndex];
                const hasChanged = 
                    currentStepName !== currentStep.step || 
                    currentDisplayText !== currentStep.display_text || 
                    currentSystemPrompt !== currentStep.system_prompt;
                
                if (hasChanged) {
                    // 保存当前状态到撤销栈
                    saveStateToUndoStack();

                    // 更新当前步骤的数据
                    config.flow[currentStepIndex].step = currentStepName;
                    config.flow[currentStepIndex].display_text = currentDisplayText;
                    config.flow[currentStepIndex].system_prompt = currentSystemPrompt;

                    // 更新列表中对应的步骤名称
                    const items = flowList.getElementsByTagName('li');
                    if (items[currentStepIndex]) {
                        items[currentStepIndex].innerText = config.flow[currentStepIndex].step || '未命名步骤';
                    }
                    
                    // 检查是否有实际更改
                    hasUnsavedChanges = checkUnsavedChanges();
                }
            }, 500); // 延迟500毫秒
        }
    }

    stepNameInput.addEventListener('input', handleInputEvent);
    displayTextInput.addEventListener('input', handleInputEvent);
    systemPromptInput.addEventListener('input', handleInputEvent);

    // 监听全局键盘事件
    window.addEventListener('keydown', async (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

        // 如果焦点在输入框或文本域中，不拦截 Ctrl+Z 和 Ctrl+Y，让浏览器处理
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
            // 处理 Ctrl+S 保存快捷键
            if (ctrlKey && e.key.toLowerCase() === 's') {
                e.preventDefault();
                await saveBtn.click();
            }
            return;
        }

        if (ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            handleUndo();
        } else if ((ctrlKey && e.key.toLowerCase() === 'y') || (ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z')) {
            e.preventDefault();
            handleRedo();
        }
        // 处理 Ctrl+S 保存快捷键
        if (ctrlKey && e.key.toLowerCase() === 's') {
            e.preventDefault();
            await saveBtn.click();
        }
    });

    // 流程管理事件监听器
    createFlowBtn.addEventListener('click', async () => {
        // 在创建新流程前，检查是否有未保存的更改
        if (hasUnsavedChanges) {
            const confirmSave = await showMessage('未保存的更改', '在创建新流程前是否保存当前更改?', 'question', true);
            if (confirmSave) {
                await saveCurrentFlowConfig();
            }
        }

        const flowName = await showPrompt('创建新流程', '请输入新流程名称:');

        if (flowName) {
            if (flowName === 'default') {
                showMessage('创建错误', '流程名称不能为 "default"。');
                return;
            }
            try {
                // 初始化流程，配置为空
                await ipcRenderer.invoke('create-flow', flowName, { flow: [] });
                await loadFlowList(flowName);
                showMessage('成功', `流程 '${flowName}' 已创建。`);
            } catch (error) {
                showMessage('创建错误', `创建流程时出错: ${error.message}`);
            }
        }
    });

    renameFlowBtn.addEventListener('click', async () => {
        if (!currentFlowName) {
            showMessage('未选择', '请选择一个流程进行重命名。');
            return;
        }

        const newFlowName = await showPrompt('重命名流程', '请输入新的流程名称:');

        if (newFlowName) {
            if (newFlowName === 'default') {
                showMessage('重命名错误', '流程名称不能为 "default"。');
                return;
            }
            try {
                await ipcRenderer.invoke('rename-flow', currentFlowName, newFlowName);
                await loadFlowList(newFlowName);
                showMessage('成功', `流程已重命名为 '${newFlowName}'。`);
            } catch (error) {
                showMessage('重命名错误', `重命名流程时出错: ${error.message}`);
            }
        }
    });

    deleteFlowBtn.addEventListener('click', async () => {
        if (!currentFlowName) {
            showMessage('未选择', '请选择一个流程进行删除。');
            return;
        }
        const flowNameToDelete = currentFlowName; // 保存要删除的流程名称
        const confirm = await showMessage('删除流程', `您确定要删除流程 '${flowNameToDelete}' 吗?`, 'question', true);
        if (confirm) {
            try {
                await ipcRenderer.invoke('delete-flow', flowNameToDelete);
                await loadFlowList();
                showMessage('成功', `流程 '${flowNameToDelete}' 已删除。`);
            } catch (error) {
                showMessage('删除错误', `删除流程时出错: ${error.message}`);
            }
        }
    });

    setDefaultBtn.addEventListener('click', async () => {
        if (!currentFlowName) {
            showMessage('未选择', '请选择一个流程进行设置。');
            return;
        }
        try {
            const unsavedChanges = hasUnsavedChanges;
            if (unsavedChanges) {
                const confirmSave = await showMessage('未保存的更改', '设置默认流程需要保存当前更改。是否保存？', 'question', true);
                if (confirmSave) {
                    await saveCurrentFlowConfig();
                } else {
                    showMessage('操作取消', '未保存更改，无法设置默认流程。');
                    return;
                }
            }
            await ipcRenderer.invoke('set-default-flow', currentFlowName);
            defaultFlowName = currentFlowName;
            updateFlowSelectOptions();
            showMessage('成功', `流程 '${currentFlowName}' 已设为默认流程。`);
        } catch (error) {
            showMessage('设置错误', `设置默认流程时出错: ${error.message}`);
        }
    });

    flowSelect.addEventListener('change', async () => {
        const selectedFlow = flowSelect.value;
        if (selectedFlow === currentFlowName) {
            return;
        }
        if (hasUnsavedChanges) {
            const confirm = await showMessage('未保存的更改', '切换流程前是否保存当前更改?', 'question', true);
            if (confirm) {
                try {
                    await saveCurrentFlowConfig();
                } catch (error) {
                    showMessage('保存错误', `保存当前流程配置时出错: ${error.message}`);
                }
            }
        }
        currentFlowName = selectedFlow;
        await loadConfig(currentFlowName);
    });

    // 导出 JSON 按钮事件监听
    exportJsonBtn.addEventListener('click', async () => {
        try {
            const configData = JSON.stringify(config, null, 2);
            const result = await ipcRenderer.invoke('export-config-json', currentFlowName, configData);
            if (result) {
                showMessage('导出成功', '流程已成功导出为 JSON 文件。');
            } else {
                // 用户取消了操作，不显示消息
            }
        } catch (error) {
            showMessage('导出错误', `导出流程时出错: ${error.message}`);
        }
    });

    // 导入 JSON 按钮事件监听
    importJsonBtn.addEventListener('click', async () => {
        try {
            // 检查是否有未保存的更改
            if (hasUnsavedChanges) {
                const confirmSave = await showMessage('未保存的更改', '导入新流程前是否保存当前更改?', 'question', true);
                if (confirmSave) {
                    await saveCurrentFlowConfig();
                }
            }

            // 请求主进程打开文件对话框
            const filePath = await ipcRenderer.invoke('open-file-dialog');

            if (!filePath) {
                return;
            }

            const data = fs.readFileSync(filePath, 'utf8');
            let configData;
            try {
                configData = JSON.parse(data);
            } catch (parseError) {
                showMessage('导入错误', '选择的文件不是有效的 JSON 文件。');
                return;
            }

            // 询问用户输入新流程名称
            const flowName = await showPrompt('导入 JSON', '请输入新流程的名称:');

            if (!flowName) {
                showMessage('导入取消', '未输入流程名称，导入已取消。');
                return;
            }

            // 创建新流程
            await ipcRenderer.invoke('import-flow', flowName, configData);
            await loadFlowList(flowName);
            showMessage('导入成功', `流程 '${flowName}' 已成功导入。`);
        } catch (error) {
            showMessage('导入错误', `导入流程时出错: ${error.message}`);
        }
    });

    // 点击目标网址链接
    urlLabel.addEventListener('click', (e) => {
        // 默认行为是在新窗口打开，这里什么都不做即可
    });

    // 添加解释选项卡按钮事件
    addExplanationBtn.addEventListener('click', () => {
        if (currentStepIndex < 0) {
            showMessage('未选择', '请先选择一个步骤。');
            return;
        }
        
        // 打开编辑器添加新选项卡
        openExplanationEditor(-1);
    });
    
    // 解释选项卡列表事件委托
    explanationsList.addEventListener('click', (e) => {
        const target = e.target;
        const index = target.dataset.index ? parseInt(target.dataset.index) : -1;
        
        if (target.classList.contains('edit-explanation-btn') && index >= 0) {
            openExplanationEditor(index);
        } else if (target.classList.contains('remove-explanation-btn') && index >= 0) {
            showMessage('删除选项卡', '确定要删除这个解释选项卡吗?', 'question', true).then(confirm => {
                if (confirm) {
                    // 保存当前状态到撤销栈
                    saveStateToUndoStack();
                    
                    // 删除选项卡
                    config.flow[currentStepIndex].explanations.splice(index, 1);
                    
                    // 更新界面
                    updateExplanationsList(config.flow[currentStepIndex].explanations);
                    
                    hasUnsavedChanges = true;
                }
            });
        }
    });

    // 解释选项卡编辑器事件
    explanationContentInput.addEventListener('input', updateExplanationPreview);
    saveExplanationBtn.addEventListener('click', saveExplanation);
    cancelExplanationBtn.addEventListener('click', closeExplanationEditor);

    // 页面加载完成时初始化
    window.onload = init;
}

// 保存当前步骤的更改
function saveCurrentStepChanges() {
    if (currentStepIndex >= 0 && config.flow[currentStepIndex]) {
        config.flow[currentStepIndex].step = stepNameInput.value.trim();
        config.flow[currentStepIndex].display_text = displayTextInput.value;
        config.flow[currentStepIndex].system_prompt = systemPromptInput.value;
        
        // explanations 字段已在编辑时保存，这里不需要额外处理
    }
}

// 撤销操作
function handleUndo() {
    if (undoStack.length > 0) {
        // 将当前状态压入 redo 栈
        redoStack.push(getState());

        // 从 undo 栈弹出状态并设置
        const prevState = undoStack.pop();
        justUndone = true; // 标记刚刚执行了撤销操作
        setState(prevState);
        hasUnsavedChanges = true;
    }
}

// 重做操作
function handleRedo() {
    if (redoStack.length > 0) {
        // 将当前状态压入 undo 栈
        undoStack.push(getState());

        // 从 redo 栈弹出状态并设置
        const nextState = redoStack.pop();
        justUndone = false;
        setState(nextState);
        hasUnsavedChanges = true;
    }
}

// 加载流程列表
async function loadFlowList(selectedFlowName) {
    try {
        const flowNames = await ipcRenderer.invoke('get-flow-list');
        const defaultFlow = await ipcRenderer.invoke('get-default-flow');
        defaultFlowName = defaultFlow;
        flowSelect.innerHTML = '';

        flowNames.forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.innerText = name;
            flowSelect.appendChild(option);
        });

        // 设置当前流程
        currentFlowName = selectedFlowName || (flowNames.length > 0 ? flowNames[0] : '');
        if (currentFlowName) {
            flowSelect.value = currentFlowName;
        }

        updateFlowSelectOptions();

        await loadConfig(currentFlowName);
    } catch (error) {
        showMessage('加载错误', `加载流程列表时出错: ${error.message}`);
    }
}

// 更新流程选择下拉框的选项，标记默认流程
function updateFlowSelectOptions() {
    const options = flowSelect.options;
    for (let i = 0; i < options.length; i++) {
        const option = options[i];
        if (option.value === defaultFlowName) {
            option.textContent = `${option.value} (默认)`;
        } else {
            option.textContent = option.value;
        }
    }
}

// 保存当前流程配置
async function saveCurrentFlowConfig() {
    try {
        await ipcRenderer.invoke('save-config', currentFlowName, JSON.stringify(config, null, 2));
        // 更新原始配置
        originalConfig = JSON.parse(JSON.stringify(config));
        // 清空撤销和重做栈
        undoStack = [];
        redoStack = [];
        hasUnsavedChanges = false;
    } catch (error) {
        throw error;
    }
}

// 加载配置
async function loadConfig(flowName) {
    // 清空撤销和重做栈
    undoStack = [];
    redoStack = [];

    try {
        const data = await ipcRenderer.invoke('get-config', flowName);
        if (data) {
            try {
                config = JSON.parse(data);
                if (!Array.isArray(config.flow)) {
                    config.flow = [];
                    console.warn('配置中的 flow 不是数组，已初始化为空数组。');
                }
                // 保存原始配置的深拷贝
                originalConfig = JSON.parse(JSON.stringify(config));
            } catch (e) {
                config = { flow: [] };
                originalConfig = { flow: [] };
                showMessage('配置解析错误', '无法解析 Redis 中的配置数据。');
                console.error('配置解析错误:', e);
            }
        } else {
            config = { flow: [] };
            originalConfig = { flow: [] };
            // 不显示错误消息，因为可能是新建的流程
        }
        currentStepIndex = -1;
        hasUnsavedChanges = false;
        updateFlowList();
        clearPromptView();
    } catch (error) {
        showMessage('加载错误', `加载配置时出错: ${error.message}`);
        config = { flow: [] };
        originalConfig = { flow: [] };
    }
}

// 更新步骤列表
function updateFlowList() {
    flowList.innerHTML = '';
    config.flow.forEach((step, index) => {
        const li = document.createElement('li');
        li.innerText = step.step || '未命名步骤';
        if (index === currentStepIndex) {
            li.classList.add('selected');
        }
        flowList.appendChild(li);
    });
}

// 更新提示视图
function updatePromptView() {
    if (currentStepIndex >= 0 && config.flow[currentStepIndex]) {
        const step = config.flow[currentStepIndex];
        stepNameInput.value = step.step || '';
        displayTextInput.value = step.display_text || '';
        systemPromptInput.value = step.system_prompt || '';
        
        // 更新解释选项卡
        updateExplanationsList(step.explanations || []);
    } else {
        clearPromptView();
    }
}

// 清除提示视图
function clearPromptView() {
    stepNameInput.value = '';
    displayTextInput.value = '';
    systemPromptInput.value = '';
    explanationsList.innerHTML = '';
}

// 选择列表项
function selectListItem(index) {
    const items = flowList.getElementsByTagName('li');
    for (let i = 0; i < items.length; i++) {
        items[i].classList.remove('selected');
    }
    if (items[index]) {
        items[index].classList.add('selected');
    }
    currentStepIndex = index;
    updatePromptView();
}

// 显示输入框
function showPrompt(title, message) {
    return new Promise((resolve) => {
        promptTitle.innerText = title;
        promptText.innerText = message;
        promptInput.value = '';
        promptBox.style.display = 'flex';

        const handleOk = () => {
            promptBox.style.display = 'none';
            resolve(promptInput.value.trim() || null);
            promptOkBtn.removeEventListener('click', handleOk);
            promptCancelBtn.removeEventListener('click', handleCancel);
            promptInput.removeEventListener('keydown', handleKeyDown);
        };

        const handleCancel = () => {
            promptBox.style.display = 'none';
            resolve(null);
            promptOkBtn.removeEventListener('click', handleOk);
            promptCancelBtn.removeEventListener('click', handleCancel);
            promptInput.removeEventListener('keydown', handleKeyDown);
        };

        const handleKeyDown = (event) => {
            if (event.key === 'Enter') {
                handleOk();
            }
        };

        promptOkBtn.addEventListener('click', handleOk);
        promptCancelBtn.addEventListener('click', handleCancel);
        promptInput.addEventListener('keydown', handleKeyDown);

        promptInput.focus();
    });
}

// 处理应用关闭事件
async function handleAppClose() {
    // 检查是否有实际的未保存更改
    const hasRealChanges = checkUnsavedChanges();
    
    if (hasRealChanges) {
        const confirmSave = await showMessage('未保存的更改', '您有未保存的更改，是否保存后退出?', 'question', true);
        if (confirmSave) {
            await saveCurrentFlowConfig();
            return true; // 允许关闭
        } else {
            const confirmDiscard = await showMessage('放弃更改', '您确定要放弃未保存的更改并退出吗?', 'question', true);
            if (confirmDiscard) {
                return true; // 允许关闭
            } else {
                return false; // 不允许关闭
            }
        }
    } else {
        return true; // 没有未保存的更改，允许关闭
    }
}

// 暴露 handleAppClose 给主进程调用
window.handleAppClose = handleAppClose;

// 更新解释选项卡列表
function updateExplanationsList(explanations) {
    explanationsList.innerHTML = '';
    
    if (!explanations || !Array.isArray(explanations)) {
        return;
    }
    
    explanations.forEach((explanation, index) => {
        const item = document.createElement('div');
        item.className = 'explanation-item';
        item.innerHTML = `
            <div class="explanation-title">${explanation.title || '未命名选项卡'}</div>
            <div class="explanation-actions">
                <button class="edit-explanation-btn" data-index="${index}">编辑</button>
                <button class="remove-explanation-btn" data-index="${index}">删除</button>
            </div>
        `;
        explanationsList.appendChild(item);
    });
}

// 打开解释选项卡编辑器
function openExplanationEditor(index) {
    currentEditingExplanationIndex = index;
    
    if (index >= 0 && config.flow[currentStepIndex].explanations && config.flow[currentStepIndex].explanations[index]) {
        const explanation = config.flow[currentStepIndex].explanations[index];
        explanationTitleInput.value = explanation.title || '';
        explanationContentInput.value = explanation.content || '';
        explanationCollapsedCheckbox.checked = explanation.collapsed || false;
    } else {
        explanationTitleInput.value = '';
        explanationContentInput.value = '';
        explanationCollapsedCheckbox.checked = true;
    }
    
    // 更新预览
    updateExplanationPreview();
    
    // 显示编辑器
    explanationEditorModal.style.display = 'flex';
}

// 关闭解释选项卡编辑器
function closeExplanationEditor() {
    explanationEditorModal.style.display = 'none';
    currentEditingExplanationIndex = -1;
}

// 更新解释选项卡预览
function updateExplanationPreview() {
    const content = explanationContentInput.value;
    explanationPreview.innerHTML = window.marked ? window.marked.parse(content) : content;
}

// 保存解释选项卡
function saveExplanation() {
    if (currentStepIndex < 0) {
        showMessage('未选择', '请先选择一个步骤。');
        return;
    }
    
    const title = explanationTitleInput.value.trim();
    const content = explanationContentInput.value;
    const collapsed = explanationCollapsedCheckbox.checked;
    
    // 检查是否有实际更改
    let hasChanged = false;
    
    // 确保 explanations 数组存在
    if (!config.flow[currentStepIndex].explanations) {
        config.flow[currentStepIndex].explanations = [];
        hasChanged = true;
    }
    
    if (currentEditingExplanationIndex >= 0) {
        // 编辑现有选项卡
        const currentExplanation = config.flow[currentStepIndex].explanations[currentEditingExplanationIndex];
        if (!currentExplanation || 
            currentExplanation.title !== title || 
            currentExplanation.content !== content || 
            currentExplanation.collapsed !== collapsed) {
            hasChanged = true;
        }
    } else {
        // 添加新选项卡
        hasChanged = true;
    }
    
    if (hasChanged) {
        // 保存当前状态到撤销栈
        saveStateToUndoStack();
        
        if (currentEditingExplanationIndex >= 0) {
            // 编辑现有选项卡
            config.flow[currentStepIndex].explanations[currentEditingExplanationIndex] = {
                id: `explanation_${currentEditingExplanationIndex}`,
                title: title,
                content: content,
                collapsed: collapsed
            };
        } else {
            // 添加新选项卡
            const newIndex = config.flow[currentStepIndex].explanations.length;
            config.flow[currentStepIndex].explanations.push({
                id: `explanation_${newIndex}`,
                title: title,
                content: content,
                collapsed: collapsed
            });
        }
        
        // 更新界面
        updateExplanationsList(config.flow[currentStepIndex].explanations);
        
        // 检查是否有实际更改
        hasUnsavedChanges = checkUnsavedChanges();
    }
    
    // 关闭编辑器
    closeExplanationEditor();
}

// 检查未保存更改
function checkUnsavedChanges() {
    // 保存当前步骤的更改
    saveCurrentStepChanges();
    
    // 比较当前配置和原始配置
    return !isEqual(config, originalConfig);
}

// 页面加载完成时初始化
window.onload = init;
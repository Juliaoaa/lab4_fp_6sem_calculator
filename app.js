const NOTE_FREQS = {
    '1': 261.63, '2': 293.66, '3': 329.63, '4': 349.23,
    '5': 392.00, '6': 440.00, '7': 493.88, '8': 523.25,
    '9': 587.33, '0': 659.25, '.': 698.46,
};

let audioCtx = null;
const getAudioContext = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

const playPianoNote = (freq, duration = 2.0) => {
    if (!freq) return;
    const ctx = getAudioContext();
    const t = ctx.currentTime;
    
    const osc1 = ctx.createOscillator(); 
    const osc2 = ctx.createOscillator(); 
    const gainNode = ctx.createGain();
    
    osc1.type = 'sine';
    osc1.frequency.value = freq;
    osc2.type = 'triangle';
    osc2.frequency.value = freq;
    
    gainNode.gain.setValueAtTime(0, t);
    gainNode.gain.linearRampToValueAtTime(0.6, t + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.001, t + duration);
    
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(freq * 4, t); 
    filter.frequency.exponentialRampToValueAtTime(freq, t + duration); 
    
    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(filter);
    filter.connect(ctx.destination);
    
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + duration);
    osc2.stop(t + duration);
};

const bounceHands = () => {
    const hands = document.getElementById('user-hands');
    if (hands && hands.classList.contains('active')) {
        hands.classList.add('strike');
        setTimeout(() => hands.classList.remove('strike'), 120);
    }
};

const createMelodyPlayer = (expression) => {
    const sequence = expression.replace(/\s+/g, '').split('');
    const hands = document.getElementById('user-hands');
    const tempo = 350;

    return () => {
        if (hands) hands.classList.add('active');

        sequence.forEach((char, index) => {
            if (NOTE_FREQS[char]) {
                setTimeout(() => {
                    bounceHands(); // Бьем по клавишам
                    playPianoNote(NOTE_FREQS[char], 1.5);
                    
                    const key = document.querySelector(`.key[data-val="${char}"]`);
                    if (key) {
                        key.classList.add('active-play');
                        setTimeout(() => key.classList.remove('active-play'), 200);
                    }
                }, index * tempo);
            }
        });

        const totalTime = sequence.length * tempo;
        setTimeout(() => {
            if (hands) hands.classList.remove('active');
        }, totalTime + 500);
    };
};

const initialState = { display: '0', history: '', shouldReset: false };

const evaluateExpression = (expr) => {
    try {
        const sanitized = expr
            .replace(/×/g, '*')
            .replace(/÷/g, '/')
            .replace(/([\d.]+)\^([\d.]+)/g, 'Math.pow($1,$2)')
            .replace(/√([\d.]+)/g, 'Math.sqrt($1)');
        const res = new Function(`return ${sanitized}`)();
        return Number.isFinite(res) ? String(Number(res.toFixed(8))) : 'Ошибка';
    } catch {
        return 'Ошибка';
    }
};

const updateState = (state, action) => {
    switch (action.type) {
        case 'DIGIT':
            return (state.shouldReset || state.display === '0') 
                ? { ...state, display: action.value, shouldReset: false }
                : { ...state, display: state.display + action.value };
        case 'OP':
            return { ...state, display: state.display + ' ' + action.value + ' ', shouldReset: false };
        case 'SQRT':
            return { ...state, display: '√' + state.display, shouldReset: false };
        case 'CLEAR':
            return initialState;
        case 'BACKSPACE':
            if (state.shouldReset) return { ...state, display: '0', history: '', shouldReset: false };
            if (state.display.endsWith(' ')) {
                return { ...state, display: state.display.slice(0, -3) || '0' };
            }
            return { ...state, display: state.display.length > 1 ? state.display.slice(0, -1) : '0' };
        case 'EQUAL':
            if (state.display === '0') return state;
            return { history: state.display + ' =', display: evaluateExpression(state.display), shouldReset: true };
        default:
            return state;
    }
};

let currentState = initialState;

const render = (state) => {
    const displayEl = document.getElementById('result');
    const historyEl = document.getElementById('history');
    if (displayEl) {
        displayEl.textContent = state.display;
        displayEl.scrollLeft = displayEl.scrollWidth;
    }
    if (historyEl) historyEl.textContent = state.history;
};

const handleInput = (target) => {
    getAudioContext(); 
    
    const digit = target.dataset.val;
    const action = target.dataset.action;

    if (digit) {
        currentState = updateState(currentState, { type: 'DIGIT', value: digit });
    } else if (action) {
        if (['add', 'sub', 'mul', 'div', 'pow'].includes(action)) {
            const opSymbols = { add: '+', sub: '-', mul: '×', div: '÷', pow: '^' };
            currentState = updateState(currentState, { type: 'OP', value: opSymbols[action] });
        } else if (action === 'sqrt') {
            currentState = updateState(currentState, { type: 'SQRT' });
        } else if (action === 'clear') {
            currentState = updateState(currentState, { type: 'CLEAR' });
        } else if (action === 'backspace') {
            currentState = updateState(currentState, { type: 'BACKSPACE' });
        } else if (action === 'equal') {
            const playExpressionMelody = createMelodyPlayer(currentState.display);
            currentState = updateState(currentState, { type: 'EQUAL' });
            playExpressionMelody();
        }
    }
    render(currentState);
};

document.addEventListener('click', (e) => {
    const target = e.target.closest('button');
    if (target && (target.dataset.val || target.dataset.action)) {
        handleInput(target);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
        e.preventDefault();
        const playBtn = document.querySelector('[data-action="equal"]');
        if (playBtn) playBtn.click();
        return;
    }

    const keyMap = {
        '0': '[data-val="0"]', '1': '[data-val="1"]', '2': '[data-val="2"]', '3': '[data-val="3"]',
        '4': '[data-val="4"]', '5': '[data-val="5"]', '6': '[data-val="6"]', '7': '[data-val="7"]',
        '8': '[data-val="8"]', '9': '[data-val="9"]', '.': '[data-val="."]', ',': '[data-val="."]',
        '+': '[data-action="add"]', '-': '[data-action="sub"]', '*': '[data-action="mul"]',
        '/': '[data-action="div"]', '^': '[data-action="pow"]',
        'Enter': '[data-action="equal"]', '=': '[data-action="equal"]',
        'Backspace': '[data-action="backspace"]',
        'Escape': '[data-action="clear"]', 'c': '[data-action="clear"]', 'C': '[data-action="clear"]'
    };

    const selector = keyMap[e.key];
    
    if (selector) {
        e.preventDefault(); 
        const button = document.querySelector(selector);
        if (button) {
            button.click(); 
            button.style.transform = 'translateY(2px)';
            button.style.filter = 'brightness(0.8)';
            setTimeout(() => {
                button.style.transform = '';
                button.style.filter = '';
            }, 100);
        }
    }
});
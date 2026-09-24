const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
];

// each cell is 7 chars wide, 3 lines tall
const GLYPH = {
    X: ['  \\ /  ', '   X   ', '  / \\  '],
    O: ['  .-.  ', ' (   ) ', "  '-'  "],
};
const blank = (i) => ['       ', `   ${i + 1}   `, '       '];
const DIVIDER = '-------+-------+-------\n';

const CPU = 'O';
const CPU_DELAY = 400;

const els = {
    board: document.getElementById('board'),
    status: document.getElementById('status'),
    score: document.getElementById('score'),
    restart: document.getElementById('restart'),
    mode: document.getElementById('mode'),
};

let board;
let turn;
let result; // null while playing, then 'X' | 'O' | 'draw'
let winLine;
let starter = 'X';
let vsCpu = true;
let round = 0; // bumped every round so stale cpu timeouts bail out
let hot = null; // hovered cell index
const score = { X: 0, O: 0, draw: 0 };

const other = (mark) => (mark === 'X' ? 'O' : 'X');
const empties = (b) => b.flatMap((v, i) => (v ? [] : [i]));

function winner(b) {
    for (const line of LINES) {
        const [a, c, d] = line;
        if (b[a] && b[a] === b[c] && b[a] === b[d]) return { mark: b[a], line };
    }
    return b.every(Boolean) ? { mark: 'draw', line: null } : null;
}

// minimax, preferring faster wins and slower losses
function minimax(b, mover, depth) {
    const w = winner(b);
    if (w) {
        if (w.mark === 'draw') return 0;
        return w.mark === CPU ? 10 - depth : depth - 10;
    }
    let best = mover === CPU ? -Infinity : Infinity;
    for (const i of empties(b)) {
        b[i] = mover;
        const s = minimax(b, other(mover), depth + 1);
        b[i] = null;
        best = mover === CPU ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
}

function bestMove(b) {
    const open = empties(b);
    // every opening is a draw with perfect play, skip the full search
    if (open.length === 9) return open[Math.floor(Math.random() * 9)];

    let best = -Infinity;
    let moves = [];
    for (const i of open) {
        b[i] = CPU;
        const s = minimax(b, other(CPU), 1);
        b[i] = null;
        if (s > best) {
            best = s;
            moves = [i];
        } else if (s === best) {
            moves.push(i);
        }
    }
    return moves[Math.floor(Math.random() * moves.length)];
}

const isCpuTurn = () => vsCpu && !result && turn === CPU;
const canPlay = (i) => !result && !isCpuTurn() && !board[i];

function newRound() {
    board = Array(9).fill(null);
    turn = starter;
    starter = other(starter);
    result = null;
    winLine = null;
    round++;
    render();
    scheduleCpu();
}

function place(i) {
    board[i] = turn;
    const w = winner(board);
    if (w) {
        result = w.mark;
        winLine = w.line;
        score[result]++;
    } else {
        turn = other(turn);
    }
    render();
    scheduleCpu();
}

function scheduleCpu() {
    if (!isCpuTurn()) return;
    const r = round;
    setTimeout(() => {
        if (r === round && isCpuTurn()) place(bestMove(board));
    }, CPU_DELAY);
}

function play(i) {
    if (canPlay(i)) place(i);
}

function toggleMode() {
    vsCpu = !vsCpu;
    score.X = score.O = score.draw = 0;
    starter = 'X';
    newRound();
}

const name = (mark) => (vsCpu ? (mark === CPU ? 'cpu' : 'you') : mark);

function statusText() {
    if (result === 'draw') return 'draw.';
    if (result) return vsCpu ? (result === CPU ? 'cpu wins.' : 'you win!') : `${result} wins!`;
    if (vsCpu) return turn === CPU ? 'cpu is thinking...' : `your move (${turn})`;
    return `${turn} to move`;
}

function render() {
    const frag = document.createDocumentFragment();
    for (let row = 0; row < 3; row++) {
        for (let line = 0; line < 3; line++) {
            for (let col = 0; col < 3; col++) {
                const i = row * 3 + col;
                const mark = board[i];
                const span = document.createElement('span');
                span.dataset.i = i;
                span.textContent = (mark ? GLYPH[mark] : blank(i))[line];
                span.classList.add('cell', mark ? mark.toLowerCase() : 'empty');
                if (canPlay(i)) span.classList.add('playable');
                if (i === hot) span.classList.add('hot');
                if (winLine?.includes(i)) span.classList.add('win');
                frag.append(span);
                if (col < 2) frag.append('|');
            }
            frag.append('\n');
        }
        if (row < 2) frag.append(DIVIDER);
    }
    els.board.replaceChildren(frag);
    els.board.classList.toggle('over', !!result);
    els.board.setAttribute('aria-label', boardLabel());

    els.status.textContent = result ? `${statusText()} click the board or press r` : statusText();
    els.score.textContent = `${name('X')} ${score.X}  ·  ${name('O')} ${score.O}  ·  draw ${score.draw}`;
    els.mode.textContent = `[m] mode: ${vsCpu ? 'vs cpu' : '2 players'}`;
}

function boardLabel() {
    const rows = [0, 3, 6].map((s) => board.slice(s, s + 3).map((v, k) => v ?? s + k + 1).join(' '));
    return `board: ${rows.join(', ')}`;
}

function setHot(i) {
    if (i === hot) return;
    hot = i;
    for (const span of els.board.querySelectorAll('.cell')) {
        span.classList.toggle('hot', Number(span.dataset.i) === hot);
    }
}

els.board.addEventListener('click', (e) => {
    if (result) return newRound();
    const cell = e.target.closest('.cell');
    if (cell) play(Number(cell.dataset.i));
});

els.board.addEventListener('pointerover', (e) => {
    const cell = e.target.closest('.cell');
    setHot(cell ? Number(cell.dataset.i) : null);
});

els.board.addEventListener('pointerleave', () => setHot(null));

els.restart.addEventListener('click', newRound);
els.mode.addEventListener('click', toggleMode);

document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) play(Number(e.key) - 1);
    else if (e.key === 'r' || e.key === 'R') newRound();
    else if (e.key === 'm' || e.key === 'M') toggleMode();
});

newRound();

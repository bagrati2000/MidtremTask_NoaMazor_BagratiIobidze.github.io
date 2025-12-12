let isScormConnected = false;

document.addEventListener('DOMContentLoaded', function () {
    if(!window.pipwerks ||!pipwerks.SCORM){
        console.log('Pipwerks not loaded!');
        return;
    }

    isScormConnected =pipwerks.SCORM.init();
    if(!isScormConnected){
        console.log('SCORM init failed!');
        return;
    }

    fetchLearnerData();

})
function fetchLearnerData() {
    if(isScormConnected){
        const learnerName = pipwerks.SCORM.get('cmi.core.student_name') || '';
        const learnerId = pipwerks.SCORM.get('cmi.core.student_id') || '';
        const status = pipwerks.SCORM.get('cmi.core.lesson_status') || '';

        console.log('--- SCORM Learner Data ---');
        console.log('Name = ' + learnerName);
        console.log('ID = ' + learnerId);
        console.log('Status = ' + status);
        console.log('---------------------------');


    }
}

window.addEventListener('beforeunload',saveAndCloseSession);

function saveAndCloseSession() {
    if(isScormConnected){
        pipwerks.SCORM.save();
        pipwerks.SCORM.quit();
    }
}

function sendInteractionsBatchToLMS(interactions){
    if(!Array.isArray(interactions) || !interactions.length===0){
        return;
    }
    if(isScormConnected){
        const scorm = pipwerks.SCORM;
        let i = parseInt(scorm.get('cmi.interactions._count') || '0', 10);
        if (!Number.isFinite(i)) i = 0;

        interactions.forEach(it => {
            const base = `cmi.interactions.${i}`;
            scorm.set(`${base}.id`, it.id);
            scorm.set(`${base}.type`, it.type);
            scorm.set(`${base}.student_response`, it.student_response);
            scorm.set(`${base}.result`, it.result);
            scorm.set(`${base}.correct_responses.0.pattern`, it.correct_responses);
            i += 1;
        });
        scorm.save();
    }
}

function finalizeAndCloseLMSConnection(){
    if(isScormConnected){
        setFinalizeDisabled(true);

    }

    if (!Array.isArray(interactionsBatch) || interactionsBatch.length === 0) {
        console.warn('[Finalize] No interactions batch found. Run the check step first.');
        return;
    }

    showModal('modal-submit');

    if(isScormConnected){
        pipwerks.SCORM.set('cmi.core.lesson_status','completed')
        pipwerks.SCORM.set('cmi.core.exit','logout');
        pipwerks.SCORM.save();
    }

    //pipwerks.SCORM.quit();
    setTimeout(() => {
        if(isScormConnected){
            pipwerks.SCORM.quit();
        }
        const modal = document.getElementById('modal-submit');
        // Flip modal content to success (no second modal involved)
        modal.querySelector('#state-loading').classList.add('d-none');
        modal.querySelector('#state-success').classList.remove('d-none');
    }, 150);

}


document.addEventListener('DOMContentLoaded',()=> {

    const searchInput = document.getElementById('search-input');
    const searchButton = document.getElementById('search-button');
    const cards = document.querySelectorAll('#units .card')

    console.log(searchButton, searchInput, cards);

    function filterUnits(){
        const termRaw = searchInput.value;
        const term = termRaw.trim().toLowerCase();

        if(term ===''){
            cards.forEach(card => {
                const col = card.closest('.col');
                if(col){
                    col.classList.remove('d-none');
                }
            });
            return;
        }

        cards.forEach(card => {
        //כותרת הכרטיס
        const titleEl = card.querySelector('.card-title');
        const titleRaw = titleEl ? titleEl.textContent : ''; //  יקבל מחרוזת ריקה במקום לגרום שגיאה titleRaw המשתנה i('') כאילו ריק  false יקבל את הטקסט הפנימי של האלמנט ואם זה  titleRaw אם האובייקט קיים המשתנה  titleEl.textContent קיים אם קיים  titleEl הקוד בודק רק עם המשתנה 
        //נרמול
        const title = titleRaw.toLowerCase();
        //בדיקה האם הכותרת כוללת את מה שהמשתמש חיפש
        const match = title.includes(term);
        //הצגה/הסתרה
        const col = card.closest('.col')
        if(!col) return;

        if(match){
            col.classList.remove('d-none'); //להציג
        }else{
            col.classList.add('d-none'); //להסתיר
        }

        });

    }

    searchButton.addEventListener('click', (e) => {
        e.preventDefault();//שלא ישלח טופס
        filterUnits();
    })

    searchInput.addEventListener('input',() => {
        filterUnits();
    });

});

let form;
//Batch saves all the interactions for sanding and grading
let interactionsBatch = [];

function handleQuizSubmit(e) {
    e.preventDefault();
    // First: make sure everything required is answered
    if (!allRequiredAnswered()) return;
    // Disable the check button after successful check
    setCheckDisabled(true);
    // Then chackQuiz, show feedback & collect interactions
    const interactions = chackQuiz();
    console.log(interactions);

    interactionsBatch = interactions;//NEW
    //  send to LMS
    sendInteractionsBatchToLMS(interactions);

    // Scroll always to the first question with small offset 
    const firstQuestion = form.querySelector('article');
    if (firstQuestion) {
        const y = firstQuestion.getBoundingClientRect().top + window.pageYOffset - 120;
        window.scrollTo({top: y, behavior: 'smooth'});
    }
    finalizeAndCloseLMSConnection();
}


// chackQuiz per question
function chackQuiz() {
    // Answer key
    const ANSWERS = {
        // חד-ברירה q1
        // q2 — דעה אישית 
        // q3 - מענה פתוח ללא ציון ממוחשב
    };

    interactionsBatch = [];

    // Q1: opinion — always accepted (neutral result)
    (function () {
        const article = document.getElementById('q1-title')?.closest('article');
        if (!article) return;

        const chosen = form.querySelector('input[name="q1"]:checked');
        const ok = !!chosen;
        const msgOk = 'תודה! קיבלנו את נושא הפנייה שלך.';
        setFeedback(article, ok, msgOk, null, true);

        const selectedText = getChosenRadioText(article, 'q1');
        interactionsBatch.push({
            id: 'Q1_preferred_technique',
            type: 'choice',
            student_response: selectedText,
            result: 'neutral',
            correct_responses: ['אין תשובה נכונה לשאלה זו']
        });
    })();

        // Q2: open text — neutral (no grading)
    (function () {
        const article = document.getElementById('q2-title')?.closest('article');
        if (!article) return;

        const raw = (form.q2?.value || '').trim();
        const len = raw.length;
        const MIN = 0, MAX = 2000;

        const ok = len >= MIN && len <= MAX;
        let msgOk = 'תודה! קיבלנו את הבעיה/הבקשה שלך.';
        setFeedback(article, ok, msgOk, null, true);

        const safeResponse = raw.slice(0, MAX);
        interactionsBatch.push({
            id: 'Q2_open_text',
            type: 'fill-in',
            student_response: safeResponse,
            result: 'neutral',
            correct_responses: ['אין תשובה נכונה לשאלה זו']
        });
    })();

    // Q3: opinion — always accepted (neutral result)
    (function () {
        const article = document.getElementById('q3-title')?.closest('article');
        if (!article) return;

        const chosen = form.querySelector('input[name="q3"]:checked');
        const ok = !!chosen;
        const msgOk = 'תודה! קיבלנו את רמת דחיפות הפנייה שלך.';
        setFeedback(article, ok, msgOk, null, true);

        const selectedText = getChosenRadioText(article, 'q3');
        interactionsBatch.push({
            id: 'Q3_preferred_technique',
            type: 'choice',
            student_response: selectedText,
            result: 'neutral',
            correct_responses: ['אין תשובה נכונה לשאלה זו']
        });
    })();


    return interactionsBatch;
}

document.addEventListener('DOMContentLoaded', () => {
    form = document.getElementById('quiz-form');
    if (!form) return;
    form.addEventListener('submit', handleQuizSubmit);
});


//================Helpers=========================
// Create/clear feedback block inside a question <article>
function setFeedback(article, isCorrect, message, details, noPrefix = false) {
    // wipe previous state
    article.classList.remove('is-correct', 'is-incorrect');
    const prev = article.querySelector('.q-feedback');
    if (prev) prev.remove();

    // add feedback container
    const wrap = document.createElement('div');
    wrap.className = 'q-feedback';
    wrap.setAttribute('role', 'status');
    wrap.setAttribute('aria-live', 'polite');

    const alert = document.createElement('div');
    alert.className = 'alert ' + (isCorrect ? 'alert-success' : 'alert-danger') + ' mb-0';
    const TEXT_OK = 'מעולה — תשובה נכונה.';
    const TEXT_ERR = 'לא מדויק — ראו הסבר:';

    // choose message format
    const prefix = noPrefix ? '' : `<strong>${isCorrect ? TEXT_OK : TEXT_ERR}</strong> `;
    alert.innerHTML = `${prefix}${message || ''}${details ? `<div class="mt-1 small text-muted">${details}</div>` : ''}`;

    wrap.appendChild(alert);
    article.appendChild(wrap);

    // color the card border
    article.classList.add(isCorrect ? 'is-correct' : 'is-incorrect');
}
// Validate required fields; if invalid, let browser show built-in bubbles
function allRequiredAnswered() {
    if (form.checkValidity()) return true;
    // Focus first invalid
    const firstInvalid = form.querySelector(':invalid');
    if (firstInvalid) firstInvalid.focus({preventScroll: false});
    form.reportValidity();
    return false;
}

// Returns the visible label text for a chosen radio in a given <article>
function getChosenRadioText(articleEl, name) {
    const input = articleEl.querySelector(`input[name="${name}"]:checked`);
    if (!input) return '';
    const label = articleEl.querySelector(`label[for="${input.id}"]`);
    return label ? label.textContent.trim() : '';
}


// Enable/disable the final submission button
function setFinalizeDisabled(isDisabled) {
    const btn = document.getElementById('btn-finalize');
    if (!btn) return;
    if (isDisabled) {
        btn.disabled = true;
        btn.setAttribute('aria-disabled', 'true');
    } else {
        btn.disabled = false;
        btn.removeAttribute('aria-disabled');
    }
}

function setCheckDisabled(isDisabled) {
    const btn = document.getElementById('btn-check');
    if (!btn) return;
    btn.disabled = !!isDisabled;
    if (isDisabled) btn.setAttribute('aria-disabled', 'true');
    else btn.removeAttribute('aria-disabled');
}

// Modal helpers 
function showModal(id) {
    if (!window.bootstrap) return;
    const el = document.getElementById(id);
    if (!el) return;
    const inst = bootstrap.Modal.getOrCreateInstance(el);
    inst.show();

}

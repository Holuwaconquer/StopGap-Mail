// DOM elements
const fetchMail = document.getElementById('fetchMail');
const email = document.getElementById('email');
const clipboard = document.getElementById('clipboard');
const mailFrom = document.getElementById('mailFrom');
const mailSubject = document.getElementById('mailSubject');
const emailContent = document.getElementById('emailContent');
const inboxBtn = document.getElementById('inboxBtn');
const checkBoxes = document.getElementById('checkBoxes');
const refreshBtn = document.getElementById('refreshBtn');
const selectAllCheckbox = document.getElementById('selectAll');
const deleteSelectedBtn = document.getElementById('deleteSelected');
const deleteAllBtn = document.getElementById('deleteAll');
const installBtn = document.getElementById('installBtn');

const mailApi = 'https://api.guerrillamail.com/ajax.php';
let sidToken = null;
let lastMailId = null;
let unreadCount = 0;

const AUTO_REFRESH_INTERVAL = 5000;
const dingSound = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');

function updateUnreadCounter() {
    document.title = unreadCount > 0 ? `(${unreadCount}) New Email` : 'Email Inbox';
}

function showNewMailNotification(from, subject) {
    if (Notification.permission === "granted") {
        new Notification("\ud83d\udce7 New Email", {
            body: `From: ${from}\nSubject: ${subject}`,
        });
    }
}

const apiFetch = async (params = {}) => {
    const url = new URL(mailApi);
    Object.entries(params).forEach(([key, value]) => url.searchParams.append(key, value));

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const text = await response.text();
        if (!text) return null;
        return JSON.parse(text);
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
};

async function getTempEmail() {
    const data = await apiFetch({ f: 'get_email_address' });
    if (data) {
        email.value = data.email_addr;
        sidToken = data.sid_token;
        localStorage.setItem('tempEmail', data.email_addr);
        localStorage.setItem('sidToken', data.sid_token);
    }
}

clipboard.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(email.value);
        clipboard.innerHTML = `<i style="color: rgb(113, 113, 242);" class="fa-solid fa-check"></i>`;
        setTimeout(() => clipboard.innerHTML = 'Copy', 2000);
    } catch {
        clipboard.innerHTML = '❌';
    }
});

function renderEmail(email) {
    const emailHTML = `
        <div class="emailContent" data-id="${email.id}" style='margin-bottom: 10px; color: black; width: 100%'>
            <div style='display: flex; justify-content: space-between; align-items: center'>
                <div>
                    <input type="checkbox" class="email-checkbox" data-id="${email.id}">
                    <label>${email.subject}</label>
                </div>
                <p>${email.date}</p>
            </div>
            <details>
                <summary>View Body</summary>
                <p><strong>From:</strong> ${email.from}</p>
                <p>${email.body}</p>
            </details>
            <hr>
        </div>
    `;
    emailContent.innerHTML += emailHTML;
}

async function fetchEmail(emailId) {
    const data = await apiFetch({ f: 'fetch_email', sid_token: sidToken, email_id: emailId });
    if (data) {
        const emailData = {
            id: data.mail_id,
            from: data.mail_from,
            subject: data.mail_subject,
            body: data.mail_body,
            date: data.mail_date
        };

        renderEmail(emailData);

        const savedEmails = JSON.parse(localStorage.getItem('savedEmails')) || [];
        savedEmails.push(emailData);
        localStorage.setItem('savedEmails', JSON.stringify(savedEmails));

        mailFrom.innerHTML = `
            <div class="mailfromJs" style="display: flex; align-items: center; gap: 0.7em; width: 100%;">
                <h4>New Email Received:</h4>
                <p><strong>From:</strong> ${emailData.from}</p>
                <p><strong>Subject:</strong> ${emailData.subject}...</p>
            </div>`;
        mailFrom.classList.add('blink');
    }
}

async function checkInbox(showNotification = true) {
    inboxBtn.innerHTML = `<h5 style="color: black;"><i class="fa-solid fa-repeat"></i> Message Loading</h5>`;
    const data = await apiFetch({ f: 'check_email', sid_token: sidToken, seq: 0 });
    inboxBtn.innerHTML = `<h5 style="color: black;"><i class="fa-solid fa-repeat"></i> Load Message</h5>`;

    if (data?.list?.length > 0) {
        const latest = data.list[0];
        if (latest.mail_id !== lastMailId) {
            lastMailId = latest.mail_id;
            unreadCount++;
            updateUnreadCounter();

            if (showNotification) {
                showNewMailNotification(latest.mail_from, latest.mail_subject);
                dingSound.play().catch(e => console.warn("Sound play failed:", e));
            }

            await fetchEmail(latest.mail_id);
            return true;
        }
    }
    return false;
}

function startAutoRefresh() {
    setInterval(() => checkInbox(true), AUTO_REFRESH_INTERVAL);
}

refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Refreshing...`;
    await checkInbox();
    refreshBtn.innerHTML = '🔄 Refresh Email';
    refreshBtn.disabled = false;
});

inboxBtn.addEventListener('click', async () => {
    emailContent.innerHTML = '';
    unreadCount = 0;
    updateUnreadCounter();
    await checkInbox(false);
    startAutoRefresh();
});

window.addEventListener('load', async () => {
    const storedEmail = localStorage.getItem('tempEmail');
    const storedSid = localStorage.getItem('sidToken');
    const savedEmails = JSON.parse(localStorage.getItem('savedEmails')) || [];

    if (storedEmail && storedSid) {
        email.value = storedEmail;
        sidToken = storedSid;
    } else {
        await getTempEmail();
    }

    savedEmails.forEach(renderEmail);

    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
});

selectAllCheckbox.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.email-checkbox');
    checkboxes.forEach(cb => cb.checked = selectAllCheckbox.checked);
});

deleteSelectedBtn.addEventListener('click', () => {
    const selectedIds = Array.from(document.querySelectorAll('.email-checkbox:checked')).map(cb => cb.dataset.id);
    if (!selectedIds.length) return;

    selectedIds.forEach(id => {
        const el = document.querySelector(`.emailContent[data-id="${id}"]`);
        if (el) el.remove();
    });

    const allEmails = JSON.parse(localStorage.getItem('savedEmails')) || [];
    const remaining = allEmails.filter(email => !selectedIds.includes(email.id));
    localStorage.setItem('savedEmails', JSON.stringify(remaining));
});

deleteAllBtn.addEventListener('click', () => {
    emailContent.innerHTML = '';
    localStorage.removeItem('savedEmails');
});

const goHome = () => location.href = "#container";
const goMail = () => location.href = "#inboxPage";
const goAbout = () => location.href = "#aboutPage";

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
            .then(reg => console.log('Service Worker registered.', reg))
            .catch(err => console.error('Service Worker registration failed:', err));
    });
}

let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.style.display = 'block';

    installBtn.addEventListener('click', () => {
        installBtn.style.display = 'none';
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
            console.log(`User ${choiceResult.outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
            deferredPrompt = null;
        });
    });
});

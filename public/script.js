const fetchMail = document.getElementById('fetchMail');
const email = document.getElementById('email');
const clipboard = document.getElementById('clipboard');
const mailFrom = document.getElementById('mailFrom');
const mailSubject = document.getElementById('mailSubject');
const emailContent = document.getElementById('emailContent');
const inboxBtn = document.getElementById('inboxBtn');
const checkBoxes = document.getElementById('checkBoxes');
const refreshBtn = document.getElementById('refreshBtn');

const mailApi = 'https://api.guerrillamail.com/ajax.php';
let sidToken = null;
let lastMailId = null;
let unreadCount = 0;

const AUTO_REFRESH_INTERVAL = 10000;
const dingSound = new Audio('https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg');

// Helper to update unread count in tab title
function updateUnreadCounter() {
    document.title = unreadCount > 0 ? `(${unreadCount}) New Email` : 'Email Inbox';
}

// Notification display
function showNewMailNotification(from, subject) {
    if (Notification.permission === "granted") {
        new Notification("📧 New Email", {
            body: `From: ${from}\nSubject: ${subject}`,
        });
    }
}

// API fetcher
const apiFetch = async (params = {}) => {
    const url = new URL(mailApi);
    Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
    });

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const text = await response.text();
        if (!text) return null;

        const data = JSON.parse(text);
        return data;
    } catch (error) {
        console.error('Fetch error:', error);
        return null;
    }
};

// Generate temp email (and save to localStorage)
async function getTempEmail() {
    const data = await apiFetch({ f: 'get_email_address' });
    if (data) {
        email.value = data.email_addr;
        sidToken = data.sid_token;

        // Save to localStorage
        localStorage.setItem('tempEmail', data.email_addr);
        localStorage.setItem('sidToken', data.sid_token);
    }
}

// Clipboard
clipboard.addEventListener('click', async () => {
    try {
        await navigator.clipboard.writeText(email.value);
        clipboard.innerHTML = `<i style="color: rgb(113, 113, 242);" class="fa-solid fa-check"></i>`;
        setTimeout(() => clipboard.innerHTML = 'Copy', 2000);
    } catch (err) {
        clipboard.innerHTML = '❌';
    }
});

// Fetch email and display
async function fetchEmail(emailId) {
    const data = await apiFetch({
        f: 'fetch_email',
        sid_token: sidToken,
        email_id: emailId
    });

    if (data) {
        const emailHTML = `
            <div class="emailContent" style='margin-bottom: 10px; color: black; width: 100%'>
                <div style='display: flex; justify-content: space-between; align-items: center'>
                    <div>
                        <input type="checkbox" name="email-subject">
                        <label>${data.mail_subject}</label>
                    </div>
                    <p>${data.mail_date}</p>
                </div>
                <details>
                    <summary>View Body</summary>
                    <p><strong>From:</strong> ${data.mail_from}</p>
                    <p>${data.mail_body}</p>
                </details>
                <hr>
            </div>
        `;

        emailContent.innerHTML += emailHTML;

        // Save to localStorage
        const savedEmails = JSON.parse(localStorage.getItem('savedEmails')) || [];
        savedEmails.push(emailHTML);
        localStorage.setItem('savedEmails', JSON.stringify(savedEmails));

        // Update banner
        mailFrom.innerHTML = `
            <div style="display: flex; align-items: center; gap: 0.7em; width: 100%;">
                <h4>New Email Received:</h4>
                <p><strong>From:</strong> ${data.mail_from}</p>
                <p><strong>Subject:</strong> ${data.mail_subject}...</p>
            </div>`;
        mailFrom.classList.add('blink');
    }
}

// Check for new mail
async function checkInbox(showNotification = true) {
    const data = await apiFetch({
        f: 'check_email',
        sid_token: sidToken,
        seq: 0
    });

    if (data && data.list && data.list.length > 0) {
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

// Auto refresh emails
function startAutoRefresh() {
    setInterval(() => checkInbox(true), AUTO_REFRESH_INTERVAL);
}

// Refresh button logic
refreshBtn.addEventListener('click', async () => {
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Refreshing...`;

    // Clear UI and storage
    emailContent.innerHTML = '';
    localStorage.removeItem('savedEmails');

    await checkInbox();
    refreshBtn.innerHTML = '🔄 Refresh Email';
    refreshBtn.disabled = false;
});

// Start button
inboxBtn.addEventListener('click', async () => {
    emailContent.innerHTML = '';
    unreadCount = 0;
    updateUnreadCounter();
    await checkInbox(false); // Initial check
    startAutoRefresh();
});

// Load saved state on page load
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

    // Load saved messages
    emailContent.innerHTML = savedEmails.join('');

    // Request notification permission
    if (Notification.permission !== 'granted') {
        Notification.requestPermission();
    }
});

const goHome = () =>{
    location.href = "#container"
}
const goMail = () =>{
    location.href = "#inboxPage"
}
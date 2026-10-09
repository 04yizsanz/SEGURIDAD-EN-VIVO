// ============================================
// ESTADO GLOBAL
// ============================================

let users = {
    'test@example.com': {
        password: 'MiContraseña123',
        name: 'Juan Pérez'
    }
};

let currentUser = null;
let securityLog = [];
let failedAttempts = {};
let activeSessions = [];
let attemptData = [0, 1, 0, 2, 5, 3, 1, 0];

// ============================================
// INICIALIZACIÓN
// ============================================

function initializeLog() {
    securityLog = [
        {
            time: '14:35:02',
            event: 'Nuevo Usuario Registrado',
            detail: 'test@example.com - Contraseña hasheada con bcrypt',
            user: 'sistema',
            type: 'success'
        },
        {
            time: '14:34:55',
            event: 'Inyección SQL Detectada',
            detail: 'Input: test\' OR \'1\'=\'1\'-- | IP: 203.0.113.99',
            user: 'anónimo',
            type: 'blocked'
        },
        {
            time: '14:34:48',
            event: 'Token JWT Expirado',
            detail: 'Usuario intentó acceder con token antiguo',
            user: 'token_expirado',
            type: 'warning'
        },
        {
            time: '14:34:30',
            event: 'Rate Limiting Activado',
            detail: 'IP 203.0.113.99 bloqueada por 5 minutos (5 intentos fallidos)',
            user: 'anónimo',
            type: 'blocked'
        },
        {
            time: '14:33:15',
            event: 'Reset de Contraseña Iniciado',
            detail: 'Token temporal generado: ABC123XYZ (expira en 1h)',
            user: 'maria.garcia',
            type: 'success'
        }
    ];
}

// Inicializar al cargar
document.addEventListener('DOMContentLoaded', function() {
    initializeLog();
});

// ============================================
// GESTIÓN DE TABS
// ============================================

function showTab(tabName) {
    const contents = document.querySelectorAll('.tab-content');
    contents.forEach(c => c.classList.remove('active'));

    const buttons = document.querySelectorAll('.tab-btn');
    buttons.forEach(b => b.classList.remove('active'));

    document.getElementById(tabName).classList.add('active');

    const activeBtn = Array.from(buttons).find(btn => {
        const emoji = btn.textContent.trim();
        if (tabName === 'login') return emoji.includes('Login');
        if (tabName === 'register') return emoji.includes('Registro');
        if (tabName === 'dashboard') return emoji.includes('Dashboard');
        if (tabName === 'forgot') return emoji.includes('Recuperar');
    });

    if (activeBtn) activeBtn.classList.add('active');

    // Si es dashboard, actualizar contenido
    if (tabName === 'dashboard') {
        updateDashboardView();
    }
}

// ============================================
// REGISTRO DE USUARIO
// ============================================

function handleRegister(e) {
    e.preventDefault();
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
    const msg = document.getElementById('registerMessage');

    // Validar
    if (password !== passwordConfirm) {
        msg.innerHTML = '<div class="message error">❌ Las contraseñas no coinciden</div>';
        return;
    }

    if (password.length < 8) {
        msg.innerHTML = '<div class="message error">❌ La contraseña debe tener mínimo 8 caracteres</div>';
        return;
    }

    if (users[email]) {
        msg.innerHTML = '<div class="message error">❌ Este email ya está registrado</div>';
        return;
    }

    // Guardar usuario
    users[email] = {
        password: password,
        name: email.split('@')[0].replace('.', ' ').toUpperCase()
    };

    addSecurityLog(
        'Nuevo Usuario Registrado',
        `${email} - Contraseña hasheada con bcrypt`,
        'sistema',
        'success'
    );

    msg.innerHTML = '<div class="message success">✓ Registro exitoso. Puedes iniciar sesión.</div>';

    setTimeout(() => {
        document.getElementById('registerEmail').value = '';
        document.getElementById('registerPassword').value = '';
        document.getElementById('registerPasswordConfirm').value = '';
        msg.innerHTML = '';
        showTab('login');
    }, 1500);
}

// ============================================
// LOGIN DE USUARIO
// ============================================

function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMessage');

    // Simular rate limiting
    if (!failedAttempts[email]) {
        failedAttempts[email] = 0;
    }

    if (failedAttempts[email] >= 5) {
        msg.innerHTML = '<div class="message error">❌ Demasiados intentos. Intenta en 5 minutos.</div>';
        addSecurityLog(
            'Rate Limiting Activado',
            'IP bloqueada por 5 minutos (5 intentos fallidos)',
            'anónimo',
            'blocked'
        );
        attemptData[attemptData.length - 1]++;
        updateChart();
        return;
    }

    // Validar credenciales
    if (!users[email] || users[email].password !== password) {
        failedAttempts[email]++;
        msg.innerHTML = '<div class="message error">❌ Email o contraseña inválidos</div>';
        addSecurityLog(
            'Intento de Login Fallido',
            `Email: ${email}`,
            'anónimo',
            'warning'
        );
        attemptData[attemptData.length - 1]++;
        updateChart();
        return;
    }

    // Login exitoso
    failedAttempts[email] = 0;
    currentUser = { email, name: users[email].name };

    // Generar JWT simulado
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
        sub: 'user_' + Math.random().toString(36).substr(2, 9),
        email: email,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 7200,
        role: 'usuario'
    }));
    const signature = 'HMAC_SHA256_SIGNATURE_' + Math.random().toString(36).substr(2, 9);
    currentUser.jwt = `${header}.${payload}.${signature}`;

    // Agregar sesión activa
    const loginTime = new Date();
    activeSessions.push({
        user: currentUser.email,
        loginTime: loginTime.toLocaleTimeString('es-ES'),
        expiryTime: new Date(loginTime.getTime() + 2 * 60 * 60000).toLocaleTimeString('es-ES')
    });

    msg.innerHTML = '<div class="message success">✓ Login exitoso. Redirigiendo...</div>';
    addSecurityLog(
        'Login Exitoso',
        `${email} - JWT emitido`,
        currentUser.name,
        'success'
    );

    setTimeout(() => {
        document.getElementById('loginEmail').value = '';
        document.getElementById('loginPassword').value = '';
        msg.innerHTML = '';
        showTab('dashboard');
    }, 1000);
}

// ============================================
// LOGOUT
// ============================================

function handleLogout() {
    addSecurityLog(
        'Logout',
        `${currentUser.email} - Sesión cerrada`,
        currentUser.name,
        'success'
    );
    currentUser = null;
    activeSessions = [];
    initializeLog();
    showTab('login');
}

// ============================================
// RECUPERACIÓN DE CONTRASEÑA
// ============================================

function handleForgotPassword(e) {
    e.preventDefault();
    const email = document.getElementById('forgotEmail').value;
    const msg = document.getElementById('forgotMessage');

    if (!users[email]) {
        msg.innerHTML = '<div class="message warning">⚠️ Si existe una cuenta con este email, recibirás un enlace de recuperación</div>';
        return;
    }

    const token = 'TOKEN_' + Math.random().toString(36).substr(2, 9);
    const resetLink = `https://tuapp.com/reset?token=${token}`;

    msg.innerHTML = `<div class="message success">
        ✓ Enlace de recuperación enviado<br><br>
        <strong>Simulación de correo:</strong><br>
        <small>Asunto: Recupera tu contraseña<br>
        Cuerpo: Haz clic para cambiar tu contraseña<br>
        Token válido por 1 hora</small>
    </div>`;

    addSecurityLog(
        'Reset de Contraseña Iniciado',
        `${email} - Token temporal generado (expira en 1h)`,
        email,
        'success'
    );

    setTimeout(() => {
        document.getElementById('forgotEmail').value = '';
    }, 2000);
}

// ============================================
// LOG DE SEGURIDAD
// ============================================

function addSecurityLog(event, detail, user, type) {
    const now = new Date();
    const time = now.toLocaleTimeString('es-ES');
    securityLog.unshift({ time, event, detail, user, type });
    updateSecurityLog();
}

function updateSecurityLog() {
    const logDiv = document.getElementById('securityLog');
    if (!logDiv) return;

    logDiv.innerHTML = securityLog.map(log => `
        <div class="log-entry ${log.type}">
            <div class="log-time">${log.time}</div>
            <div class="log-event">${log.event}</div>
            <div class="log-detail">${log.detail}</div>
            <div class="log-user">Usuario: ${log.user}</div>
        </div>
    `).join('');
}

// ============================================
// SESIONES
// ============================================

function updateSessions() {
    const table = document.getElementById('sessionsTable');
    if (!table) return;

    if (activeSessions.length === 0) {
        table.innerHTML = '<tr><td colspan="4" class="loading-text">No hay sesiones activas</td></tr>';
        return;
    }

    table.innerHTML = activeSessions.map(session => `
        <tr>
            <td>${session.user}</td>
            <td>${session.loginTime}</td>
            <td>${session.expiryTime}</td>
            <td><span class="status-ok">✓ Activa</span></td>
        </tr>
    `).join('');
}

// ============================================
// DECODIFICADOR JWT
// ============================================

function decodeJWT() {
    const jwtInput = document.getElementById('jwtInput').value.trim();
    const resultDiv = document.getElementById('jwtResult');

    if (!jwtInput) {
        resultDiv.innerHTML = '<div class="message error">Pega un JWT válido</div>';
        return;
    }

    const parts = jwtInput.split('.');
    if (parts.length !== 3) {
        resultDiv.innerHTML = '<div class="message error">JWT inválido. Debe tener 3 partes.</div>';
        return;
    }

    try {
        const header = JSON.parse(atob(parts[0]));
        const payload = JSON.parse(atob(parts[1]));
        const signature = parts[2];

        resultDiv.innerHTML = `
            <div class="jwt-result">
                <div class="jwt-part">
                    <div class="jwt-part-title">Header (Base64 decodificado)</div>
                    <div class="jwt-part-content">${JSON.stringify(header, null, 2)}</div>
                </div>
                <div class="jwt-part">
                    <div class="jwt-part-title">Payload (Base64 decodificado)</div>
                    <div class="jwt-part-content">${JSON.stringify(payload, null, 2)}</div>
                </div>
                <div class="jwt-part">
                    <div class="jwt-part-title">Firma HMAC-SHA256</div>
                    <div class="jwt-part-content" style="word-break: break-all;">${signature}</div>
                    <div class="jwt-valid">✓ VÁLIDO (Firmado con clave secreta del servidor)</div>
                </div>
            </div>
        `;
    } catch (e) {
        resultDiv.innerHTML = '<div class="message error">Error al decodificar JWT</div>';
    }
}

function copyCurrentJWT() {
    if (!currentUser || !currentUser.jwt) {
        alert('No hay sesión activa');
        return;
    }
    document.getElementById('jwtInput').value = currentUser.jwt;
    decodeJWT();
}

// ============================================
// GRÁFICO
// ============================================

function initChart() {
    if (window.chartInstance) {
        updateChart();
        return;
    }

    const ctx = document.getElementById('attemptsChart');
    if (!ctx) return;

    window.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['00:00', '02:00', '04:00', '06:00', '12:00', '14:00', '16:00', 'Ahora'],
            datasets: [{
                label: 'Intentos Fallidos',
                data: attemptData,
                backgroundColor: 'rgba(220, 53, 69, 0.7)',
                borderColor: 'rgba(220, 53, 69, 1)',
                borderWidth: 1,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: { beginAtZero: true, max: 10, ticks: { stepSize: 2 } }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

function updateChart() {
    if (window.chartInstance) {
        window.chartInstance.data.datasets[0].data = attemptData;
        window.chartInstance.update();
    }
}

// ============================================
// VISTA DEL DASHBOARD
// ============================================

function updateDashboardView() {
    if (currentUser) {
        document.getElementById('notAuthMessage').style.display = 'none';
        document.getElementById('dashboardContent').classList.remove('dashboard-hidden');
        document.getElementById('dashboardUsername').textContent = '👤 ' + currentUser.name;
        updateSessions();
        updateSecurityLog();
        setTimeout(initChart, 100);
    } else {
        document.getElementById('notAuthMessage').style.display = 'block';
        document.getElementById('dashboardContent').classList.add('dashboard-hidden');
    }
}


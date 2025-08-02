// 1. Impor library yang dibutuhkan
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const twilio = require('twilio');

// 2. Inisialisasi aplikasi Express
const app = express();
const PORT = 3000;

// 3. Konfigurasi Middleware
app.use(cors());
app.use(express.json());

// --- [BARU] KONFIGURASI TWILIO ---
// PENTING: Jangan pernah membagikan authToken Anda secara publik.
// Di aplikasi nyata, gunakan environment variables (process.env.TWILIO_AUTH_TOKEN).
const accountSid = 'AC811c381d88d1826e1e33c02d8b9e2b2e'; // SID Akun Anda
const authToken = 'a8e09be6fec0405a5c65c705a0f2ee14'; // Ganti dengan Auth Token Anda
const twilioClient = twilio(accountSid, authToken);
const twilioWhatsAppNumber = 'whatsapp:+14155238886'; // Nomor WhatsApp dari Twilio

// --- PENGELOLAAN DATABASE FILE JSON ---
const DB_DIR = path.join(__dirname, 'database');
const USERS_DB_PATH = path.join(DB_DIR, 'users.json');
const HISTORY_DB_PATH = path.join(DB_DIR, 'history.json');
const SCHEDULES_DB_PATH = path.join(DB_DIR, 'schedules.json');

// --- [PEMBARUAN BESAR] FUNGSI UNTUK MENGIRIM PESAN WHATSAPP LANGSUNG ---
async function sendWhatsAppReminder(patientPhoneNumber, patientName, schedule) {
    
    // Format tanggal agar lebih mudah dibaca (contoh: 13 Juli 2025)
    const formattedDate = new Date(schedule.date).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    // [PEMBARUAN] Membuat isi pesan (body) secara dinamis sesuai contoh Anda.
    // Anda bisa mengubah kalimat ini sesuai keinginan.
    const messageBody = `Halo ${patientName}, ini adalah pengingat untuk jadwal "${schedule.description}" Anda pada ${formattedDate} pukul ${schedule.time}.`;

    try {
        console.log(`[Server] Mencoba mengirim pesan ke: ${patientPhoneNumber}`);
        console.log(`[Server] Dengan isi pesan: ${messageBody}`);

        // [PEMBARUAN] Menggunakan parameter 'body' untuk mengirim pesan langsung,
        // bukan lagi 'contentSid' (template).
        const message = await twilioClient.messages.create({
            from: twilioWhatsAppNumber,
            to: patientPhoneNumber,
            body: messageBody
        });

        console.log(`[Server] Pesan pengingat berhasil dikirim. SID: ${message.sid}`);
        return { success: true, message: `Pengingat berhasil dikirim ke ${patientName}.` };
    } catch (error) {
        console.error(`[Server] Gagal mengirim pesan ke ${patientPhoneNumber}:`, error.message);
        // Pesan error ini mungkin muncul jika Anda mengirim pesan di luar "jendela 24 jam"
        // tanpa menggunakan template yang disetujui.
        return { success: false, message: 'Gagal mengirim pengingat WhatsApp. Pastikan Anda berada dalam sesi aktif dengan nomor Twilio.' };
    }
}


// Pastikan folder database ada
if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR);
}

// Fungsi untuk membaca database dari file
function loadDatabase(filePath, defaultData = {}) {
    try {
        if (fs.existsSync(filePath)) {
            const fileData = fs.readFileSync(filePath);
            return JSON.parse(fileData);
        } else {
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
    } catch (error) {
        console.error(`Gagal memuat database dari ${filePath}:`, error);
        return defaultData;
    }
}

// Fungsi untuk menyimpan database ke file
function saveDatabase(filePath, data) {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error(`Gagal menyimpan database ke ${filePath}:`, error);
    }
}

// Muat semua database dari file saat server dimulai
let users = loadDatabase(USERS_DB_PATH, {
    'terapis@prime.com': { password: 'password123', role: 'therapist' },
    'prima@prime.com': { password: 'pasien456', role: 'patient', patientId: 'Pasien-01', name: 'Prima' },
    'ilyas@prime.com': { password: 'pasien789', role: 'patient', patientId: 'Pasien-02', name: 'Ilyas' }
});
let checkupHistory = loadDatabase(HISTORY_DB_PATH, []);
let schedules = loadDatabase(SCHEDULES_DB_PATH, []);

// 4. Rute (Endpoints)

// Endpoint untuk konfirmasi server berjalan
app.get('/', (req, res) => {
    res.json({ message: 'Selamat datang di API PRIME Care. Server berjalan.' });
});

// Endpoint untuk Login
app.post('/login', (req, res) => {
    try {
        const { email, password } = req.body;
        const user = users[email];
        if (user && user.password === password) {
            res.json({ success: true, message: 'Login berhasil!', role: user.role, patientId: user.patientId });
        } else {
            res.status(401).json({ success: false, message: 'Email atau password salah.' });
        }
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// Endpoint untuk Registrasi Pasien
app.post('/api/register', (req, res) => {
    try {
        const { email, password, name, patientId } = req.body;
        if (!email || !password) return res.status(400).json({ success: false, message: 'Email dan password harus diisi.' });
        if (users[email]) return res.status(400).json({ success: false, message: 'Email sudah terdaftar.' });

        const finalPatientId = patientId || `Pasien-${String(Object.keys(users).length).padStart(2, '0')}`;
        users[email] = {
            password: password,
            role: 'patient',
            patientId: finalPatientId,
            name: name || email.split('@')[0]
        };
        saveDatabase(USERS_DB_PATH, users);
        res.status(201).json({ success: true, message: 'Pasien berhasil ditambahkan!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// Endpoint untuk Menerima Data Sesi dari ESP32
app.post('/api/checkup', (req, res) => {
    try {
        const sessionData = req.body;
        sessionData.timestamp = new Date().toISOString();
        checkupHistory.unshift(sessionData);
        saveDatabase(HISTORY_DB_PATH, checkupHistory);
        res.status(201).json({ success: true, message: 'Data sesi diterima' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Gagal memproses data sensor.' });
    }
});

// Endpoint untuk Mendapatkan Semua Riwayat Sesi (untuk Terapis)
app.get('/api/checkups', (req, res) => {
    res.json(checkupHistory);
});

// Endpoint untuk Mendapatkan Riwayat Sesi Pasien Spesifik
app.get('/api/checkups/:patientId', (req, res) => {
    const { patientId } = req.params;
    const patientHistory = checkupHistory.filter(session => session.patientId === patientId);
    res.json(patientHistory);
});

// Endpoint untuk Mendapatkan Daftar Semua Pasien (untuk Terapis)
app.get('/api/patients', (req, res) => {
    try {
        const patientList = Object.keys(users)
            .filter(email => users[email].role === 'patient')
            .map(email => ({
                email: email,
                patientId: users[email].patientId,
                name: users[email].name || email.split('@')[0]
            }));
        res.json(patientList);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// Endpoint untuk Mendapatkan Semua Jadwal
app.get('/api/schedules', (req, res) => {
    const sortedSchedules = schedules.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(sortedSchedules);
});

// Endpoint untuk Mendapatkan Jadwal Pasien Spesifik
app.get('/api/schedules/:patientId', (req, res) => {
    const { patientId } = req.params;
    const patientSchedules = schedules.filter(s => s.patientId === patientId);
    res.json(patientSchedules);
});

// Endpoint untuk Membuat Jadwal Baru
app.post('/api/schedules', (req, res) => {
    try {
        const { patientId, patientName, date, time, description } = req.body;
        if (!patientId || !date || !time || !description) {
            return res.status(400).json({ success: false, message: 'Semua field harus diisi.' });
        }
        const newSchedule = {
            id: Date.now().toString(),
            patientId, patientName, date, time, description,
            status: 'pending' // Status awal
        };
        schedules.push(newSchedule);
        saveDatabase(SCHEDULES_DB_PATH, schedules);
        res.status(201).json({ success: true, message: 'Jadwal berhasil dibuat!', schedule: newSchedule });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// [PEMBARUAN] Saat membuat jadwal, tambahkan status 'pending'
app.post('/api/schedules', (req, res) => {
    try {
        const { patientId, patientName, date, time, description } = req.body;
        // ... (validasi)
        const newSchedule = {
            id: Date.now().toString(),
            patientId, patientName, date, time, description,
            status: 'pending' // Status awal: pending
        };
        schedules.push(newSchedule);
        saveDatabase(SCHEDULES_DB_PATH, schedules);
        res.status(201).json({ success: true, message: 'Jadwal berhasil dibuat!', schedule: newSchedule });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// [PEMBARUAN] Endpoint ini sekarang bisa menangani status 'completed' dan 'canceled'
app.patch('/api/schedules/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // status baru: 'completed' atau 'canceled'

        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan.' });
        }

        schedules[scheduleIndex].status = status;
        saveDatabase(SCHEDULES_DB_PATH, schedules);
        
        res.json({ success: true, message: `Status jadwal berhasil diubah menjadi ${status}.` });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// Endpoint untuk mengirim pengingat sekarang memanggil fungsi WhatsApp dengan lebih banyak detail
app.post('/api/schedules/:id/remind', async (req, res) => {
    const { id } = req.params;
    const schedule = schedules.find(s => s.id === id);

    if (!schedule) {
        return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan.' });
    }

    const userEmail = Object.keys(users).find(email => users[email].patientId === schedule.patientId);
    const user = users[userEmail];

    if (!user || !user.phone) {
        return res.status(404).json({ success: false, message: 'Nomor telepon pasien tidak ditemukan.' });
    }

    // Panggil fungsi pengirim WhatsApp dengan seluruh objek jadwal
    const result = await sendWhatsAppReminder(user.phone, schedule.patientName, schedule);

    if (result.success) {
        res.json(result);
    } else {
        res.status(500).json(result);
    }
});


// [ENDPOINT BARU] Untuk simulasi pengiriman pengingat WhatsApp
app.post('/api/schedules/:id/remind', (req, res) => {
    const { id } = req.params;
    const schedule = schedules.find(s => s.id === id);
    if (schedule) {
        console.log(`[Server] Simulasi pengiriman pengingat WA untuk jadwal pasien ${schedule.patientName}`);
        // Di aplikasi nyata, di sinilah Anda akan memanggil API WhatsApp (misal: Twilio)
        res.json({ success: true, message: `Pengingat WhatsApp untuk ${schedule.patientName} telah dikirim.` });
    } else {
        res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan.' });
    }
});

// Endpoint untuk Menghapus Jadwal
app.delete('/api/schedules/:id', (req, res) => {
    try {
        const { id } = req.params;
        const initialLength = schedules.length;
        schedules = schedules.filter(s => s.id !== id);
        if (schedules.length === initialLength) {
            return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan.' });
        }
        saveDatabase(SCHEDULES_DB_PATH, schedules);
        res.json({ success: true, message: 'Jadwal berhasil dihapus.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// Endpoint untuk Mengubah Status Jadwal (Validasi)
app.patch('/api/schedules/:id/status', (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body; // status baru: 'completed'
        const scheduleIndex = schedules.findIndex(s => s.id === id);
        if (scheduleIndex === -1) {
            return res.status(404).json({ success: false, message: 'Jadwal tidak ditemukan.' });
        }
        schedules[scheduleIndex].status = status;
        saveDatabase(SCHEDULES_DB_PATH, schedules);
        res.json({ success: true, message: 'Status jadwal berhasil diperbarui.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// Endpoint untuk Mengubah Password
app.post('/api/change-password', (req, res) => {
    try {
        const { email, currentPassword, newPassword } = req.body;
        if (!email || !currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Semua field harus diisi.' });
        }
        const user = users[email];
        if (!user || user.password !== currentPassword) {
            return res.status(401).json({ success: false, message: 'Password saat ini salah.' });
        }
        users[email].password = newPassword;
        saveDatabase(USERS_DB_PATH, users);
        res.json({ success: true, message: 'Password berhasil diubah!' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Kesalahan internal server.' });
    }
});

// 5. Menjalankan Server
app.listen(PORT, () => {
    console.log(`Server backend berjalan di http://localhost:${PORT}`);
});

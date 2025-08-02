// frontend/js/script-terapis.js

document.addEventListener('DOMContentLoaded', () => {
    loadSummaryData();
    loadRecentPatients();
    loadUpcomingSchedules();
    checkTodaySchedules();
});

// [PEMBARUAN] Fungsi ini sekarang hanya menghitung jadwal yang statusnya 'pending'
async function checkTodaySchedules() {
    try {
        const response = await fetch('http://localhost:3000/api/schedules');
        const schedules = await response.json();
        const today = new Date().toISOString().slice(0, 10);
        
        // Hanya hitung jadwal hari ini yang belum selesai atau dibatalkan
        const todayPendingSchedules = schedules.filter(s => s.date === today && s.status === 'pending');

        if (todayPendingSchedules.length > 0) {
            const banner = document.getElementById('notification-banner');
            const text = document.getElementById('notification-text');
            text.innerHTML = `Anda memiliki <strong>${todayPendingSchedules.length}</strong> jadwal terapi hari ini yang belum selesai. <a href="jadwalterapis.html" class="font-bold underline">Lihat detail</a>`;
            banner.classList.remove('hidden');
        }
    } catch (error) {
        console.error("Gagal memeriksa jadwal hari ini:", error);
    }
}

// [PEMBARUAN] Fungsi ini juga hanya menghitung jadwal yang statusnya 'pending'
async function loadSummaryData() {
    try {
        const [patientsRes, schedulesRes, historyRes] = await Promise.all([
            fetch('http://localhost:3000/api/patients'),
            fetch('http://localhost:3000/api/schedules'),
            fetch('http://localhost:3000/api/checkups')
        ]);

        const patients = await patientsRes.json();
        const schedules = await schedulesRes.json();
        const history = await historyRes.json();

        document.getElementById('total-patients').textContent = patients.length;

        const today = new Date().toISOString().slice(0, 10);
        // Hanya hitung jadwal hari ini yang statusnya 'pending'
        const todaySchedulesCount = schedules.filter(s => s.date === today && s.status === 'pending').length;
        document.getElementById('today-schedules').textContent = todaySchedulesCount;

        const thisMonth = new Date().getMonth();
        const thisMonthSessions = history.filter(h => new Date(h.timestamp).getMonth() === thisMonth).length;
        document.getElementById('total-sessions').textContent = thisMonthSessions;

    } catch (error) {
        console.error("Gagal memuat data ringkasan:", error);
    }
}

// ... (Fungsi loadRecentPatients dan loadUpcomingSchedules tidak berubah) ...
async function loadRecentPatients() { /* ... */ }
async function loadUpcomingSchedules() { /* ... */ }

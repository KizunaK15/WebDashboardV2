// frontend/js/script-pasien.js

document.addEventListener('DOMContentLoaded', () => {
    const patientId = localStorage.getItem('patientId');
    const patientEmail = localStorage.getItem('patientEmail');

    if (!patientId) {
        alert("Sesi tidak valid. Silakan login kembali.");
        window.location.href = 'iot_login_page.html';
        return;
    }

    // Personalisasi sapaan selamat datang
    const welcomeMessage = document.getElementById('welcome-message');
    const patientName = patientEmail.split('@')[0];
    welcomeMessage.textContent = `Selamat Datang, ${patientName.charAt(0).toUpperCase() + patientName.slice(1)}!`;
    
    // Panggil semua fungsi untuk memuat data ke dashboard
    populatePatientDashboard(patientId);
    loadPatientSchedules(patientId);
    populateHistoryTable(patientId);
});

function formatDate(dateString, style = 'long') {
    const options = { year: 'numeric', month: style, day: 'numeric' };
    return new Date(dateString).toLocaleDateString('id-ID', options);
}

async function loadPatientSchedules(patientId) {
    const listElement = document.getElementById('schedule-list');
    listElement.innerHTML = '<p class="text-gray-500 text-sm">Memuat jadwal...</p>';
    try {
        const response = await fetch(`http://localhost:3000/api/schedules/${patientId}`);
        if (!response.ok) throw new Error('Gagal memuat jadwal.');

        const schedules = await response.json();
        listElement.innerHTML = '';

        if (schedules.length === 0) {
            listElement.innerHTML = '<p class="text-gray-500 text-sm">Anda belum memiliki jadwal terapi.</p>';
            return;
        }

        schedules.slice(0, 4).forEach(s => { // Tampilkan 4 jadwal terdekat
            const item = document.createElement('li');
            item.className = 'flex items-center p-3 bg-gray-50 rounded-lg schedule-item';
            item.innerHTML = `
                <div class="mr-4 text-center w-12 flex-shrink-0">
                    <p class="font-bold text-blue-800">${new Date(s.date).getDate()}</p>
                    <p class="text-xs text-blue-600">${new Date(s.date).toLocaleString('id-ID', { month: 'short' }).toUpperCase()}</p>
                </div>
                <div>
                    <p class="font-medium text-gray-800">${s.description}</p>
                    <p class="text-sm text-gray-500">${s.time}</p>
                </div>
            `;
            listElement.appendChild(item);
        });
        
        checkTodayScheduleForPatient(schedules);

    } catch (error) {
        console.error('Gagal memuat jadwal pasien:', error);
        listElement.innerHTML = '<p class="text-red-500 text-sm">Gagal memuat jadwal.</p>';
    }
}

function checkTodayScheduleForPatient(schedules) {
    const today = new Date().toISOString().slice(0, 10);
    const todaySchedule = schedules.find(s => s.date === today);

    if (todaySchedule) {
        const banner = document.getElementById('notification-banner-patient');
        const text = document.getElementById('notification-text-patient');
        text.innerHTML = `Anda memiliki jadwal terapi hari ini pukul <strong>${todaySchedule.time}</strong>. Jangan sampai terlewat!`;
        banner.classList.remove('hidden');
    }
}

async function populatePatientDashboard(patientId) {
    const API_URL = `http://localhost:3000/api/checkups/${patientId}`;
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`Gagal mengambil data. Status: ${response.status}`);
        
        const history = await response.json();

        if (!history || history.length === 0) {
            document.getElementById('latest-bpm').textContent = "N/A";
            document.getElementById('latest-spo2').textContent = "N/A";
            document.getElementById('latest-emg').textContent = "N/A";
            return;
        }

        const latestData = history[0];
        document.getElementById('latest-bpm').textContent = latestData.avgBpm.toFixed(0);
        document.getElementById('latest-spo2').textContent = latestData.avgSpo2.toFixed(0);
        document.getElementById('latest-emg').textContent = latestData.avgEmg.toFixed(0);

        const recentHistory = history.slice(0, 7).reverse();
        const labels = recentHistory.map(session => new Date(session.timestamp).toLocaleDateString('id-ID', {day: '2-digit', month: 'short'}));
        const bpmData = recentHistory.map(session => session.avgBpm);
        const spo2Data = recentHistory.map(session => session.avgSpo2);

        const ctx = document.getElementById('progressChart').getContext('2d');
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Rata-rata BPM', data: bpmData, borderColor: 'rgba(59, 130, 246, 1)', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true, tension: 0.4 },
                    { label: 'Rata-rata SpO2', data: spo2Data, borderColor: 'rgba(16, 185, 129, 1)', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true, tension: 0.4 }
                ]
            }
        });
    } catch (error) {
        console.error("Gagal memuat data dashboard pasien:", error);
    }
}

async function populateHistoryTable(patientId) {
    const tableBody = document.getElementById('history-table-body');
    const API_URL = `http://localhost:3000/api/checkups/${patientId}`;
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error('Gagal memuat riwayat.');
        
        const history = await response.json();
        tableBody.innerHTML = '';
        
        if (history.length === 0) {
            tableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4 text-gray-500">Belum ada riwayat sesi.</td></tr>';
            return;
        }
        
        history.slice(0, 5).forEach(session => { // Tampilkan 5 riwayat terakhir
            const row = `
                <tr class="bg-white border-b hover:bg-gray-50">
                    <td class="px-6 py-4">${new Date(session.timestamp).toLocaleString('id-ID', {dateStyle: 'long', timeStyle: 'short'})}</td>
                    <td class="px-6 py-4 font-medium">${session.avgBpm.toFixed(1)}</td>
                    <td class="px-6 py-4 font-medium">${session.avgSpo2.toFixed(1)}%</td>
                    <td class="px-6 py-4 font-medium">${session.avgEmg.toFixed(1)}</td>
                </tr>
            `;
            tableBody.innerHTML += row;
        });
    } catch (error) {
        tableBody.innerHTML = `<tr><td colspan="4" class="text-center p-4 text-red-500">${error.message}</td></tr>`;
    }
}

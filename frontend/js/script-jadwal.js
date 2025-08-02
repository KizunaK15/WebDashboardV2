// frontend/js/script-jadwal.js

// Event listener akan berjalan setelah seluruh halaman HTML dimuat
document.addEventListener('DOMContentLoaded', () => {
    // Inisialisasi semua elemen yang dibutuhkan dari DOM
    const patientSelect = document.getElementById('patient-select');
    const scheduleForm = document.getElementById('schedule-form');
    const upcomingTableBody = document.getElementById('upcoming-schedule-body');
    const pastTableBody = document.getElementById('past-schedule-body');
    const scheduleContainer = document.getElementById('schedule-container');

    // --- FUNGSI-FUNGSI ---

    // Fungsi untuk memuat daftar pasien ke dalam dropdown
    async function loadPatients() {
        try {
            const response = await fetch('http://localhost:3000/api/patients');
            if (!response.ok) throw new Error('Gagal memuat pasien.');
            const patients = await response.json();
            
            patientSelect.innerHTML = '<option value="">-- Pilih Pasien --</option>';
            patients.forEach(p => {
                const option = document.createElement('option');
                option.value = p.patientId;
                option.textContent = p.name.charAt(0).toUpperCase() + p.name.slice(1);
                option.dataset.name = option.textContent;
                patientSelect.appendChild(option);
            });
        } catch (error) {
            console.error('Gagal memuat pasien:', error);
            patientSelect.innerHTML = '<option>Gagal memuat</option>';
        }
    }

    // Fungsi untuk memuat dan menampilkan jadwal ke dalam dua tabel terpisah
    async function loadSchedules() {
        upcomingTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Memuat jadwal...</td></tr>';
        pastTableBody.innerHTML = '<tr><td colspan="4" class="text-center p-4">Memuat riwayat...</td></tr>';
        
        try {
            const response = await fetch('http://localhost:3000/api/schedules');
            if (!response.ok) throw new Error('Gagal memuat jadwal.');
            const schedules = await response.json();

            // Pisahkan jadwal menjadi 'akan datang' (pending) dan 'riwayat' (completed/canceled)
            const upcoming = schedules.filter(s => s.status === 'pending');
            const past = schedules.filter(s => s.status === 'completed' || s.status === 'canceled');

            renderTable(upcomingTableBody, upcoming, 'Belum ada jadwal akan datang.');
            renderTable(pastTableBody, past, 'Belum ada riwayat jadwal.');

        } catch (error) {
            console.error('Gagal memuat jadwal:', error);
            const errorMessage = `<tr><td colspan="4" class="text-center p-4 text-red-500">${error.message}</td></tr>`;
            upcomingTableBody.innerHTML = errorMessage;
            pastTableBody.innerHTML = errorMessage;
        }
    }

    // Fungsi helper untuk menampilkan data ke dalam tabel
    function renderTable(tbody, data, emptyMessage) {
        tbody.innerHTML = '';
        if (data.length === 0) {
            tbody.innerHTML = `<tr><td colspan="4" class="text-center p-4">${emptyMessage}</td></tr>`;
            return;
        }

        data.forEach(s => {
            let status, statusColor, actionButtons;

            if (s.status === 'completed') {
                status = 'Selesai';
                statusColor = 'bg-green-100 text-green-800';
                actionButtons = '<span class="text-sm text-gray-500">-</span>';
            } else if (s.status === 'canceled') {
                status = 'Dibatalkan';
                statusColor = 'bg-red-100 text-red-800';
                actionButtons = '<span class="text-sm text-gray-500">-</span>';
            } else { // status 'pending'
                status = 'Akan Datang';
                statusColor = 'bg-blue-100 text-blue-800';
                actionButtons = `
                    <div class="flex items-center space-x-2">
                        <button data-id="${s.id}" class="complete-btn action-btn bg-green-500 text-white">Sudah</button>
                        <button data-id="${s.id}" class="cancel-btn action-btn bg-yellow-500 text-white">Batalkan</button>
                        <button data-id="${s.id}" class="remind-btn action-btn bg-sky-500 text-white">Reminder</button>
                    </div>
                `;
            }

            const row = document.createElement('tr');
            row.className = 'bg-white border-b hover:bg-gray-50';
            row.innerHTML = `
                <td class="px-6 py-4 font-medium text-gray-900">${s.patientName}</td>
                <td class="px-6 py-4">${new Date(s.date).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})} <br> <span class="text-xs text-gray-500">${s.time}</span></td>
                <td class="px-6 py-4"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColor}">${status}</span></td>
                <td class="px-6 py-4">${actionButtons}</td>
            `;
            tbody.appendChild(row);
        });
    }

    // --- EVENT LISTENERS ---

    // Event handler untuk form tambah jadwal
    scheduleForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const selectedOption = patientSelect.options[patientSelect.selectedIndex];
        if (!selectedOption.value) {
            alert('Silakan pilih pasien terlebih dahulu.');
            return;
        }
        const scheduleData = {
            patientId: selectedOption.value,
            patientName: selectedOption.dataset.name,
            date: document.getElementById('schedule-date').value,
            time: document.getElementById('schedule-time').value,
            description: document.getElementById('schedule-desc').value,
        };

        try {
            const response = await fetch('http://localhost:3000/api/schedules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(scheduleData)
            });
            if (!response.ok) throw new Error('Gagal menyimpan jadwal.');
            scheduleForm.reset();
            loadSchedules();
        } catch (error) {
            alert(error.message);
        }
    });

    // Event handler untuk semua tombol aksi di dalam tabel
    scheduleContainer.addEventListener('click', async (e) => {
        const button = e.target.closest('button');
        if (!button || !button.dataset.id) return;

        const scheduleId = button.dataset.id;
        
        if (button.classList.contains('complete-btn')) {
            if (confirm('Tandai jadwal ini sebagai selesai?')) updateScheduleStatus(scheduleId, 'completed');
        }
        if (button.classList.contains('cancel-btn')) {
            if (confirm('Apakah Anda yakin ingin membatalkan jadwal ini?')) updateScheduleStatus(scheduleId, 'canceled');
        }
        if (button.classList.contains('remind-btn')) {
            try {
                const response = await fetch(`http://localhost:3000/api/schedules/${scheduleId}/remind`, { method: 'POST' });
                const result = await response.json();
                if (!response.ok) throw new Error(result.message);
                alert(result.message);
            } catch (error) {
                alert(error.message);
            }
        }
    });

    // Fungsi helper untuk update status
    async function updateScheduleStatus(id, newStatus) {
        try {
            const response = await fetch(`http://localhost:3000/api/schedules/${id}/status`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            if (!response.ok) throw new Error('Gagal memperbarui status.');
            loadSchedules();
        } catch (error) {
            alert(error.message);
        }
    }

    // --- INISIALISASI HALAMAN ---
    loadPatients();
    loadSchedules();
});

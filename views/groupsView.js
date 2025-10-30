// views/groupsView.js

import { db } from '../firebase-config.js';
import { collection, query, where, onSnapshot, doc, addDoc, deleteDoc, updateDoc, serverTimestamp, arrayUnion, arrayRemove, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { showConfirmModal } from '../utils/modals.js';
import { translations } from '../utils/translations.js';

// DOM Elements
const addGroupBtn = document.getElementById('add-group-btn');
const groupsListEl = document.getElementById('groups-list');
const groupEditorEl = document.getElementById('group-editor');
const groupPlaceholderEl = document.getElementById('group-placeholder');
const groupEditorTitleEl = document.getElementById('group-editor-title');
const deleteGroupBtn = document.getElementById('delete-group-btn');
const groupPlaylistSelectEl = document.getElementById('group-playlist-select');
const groupSimpleScheduleContainer = document.getElementById('group-simple-schedule-container');
const groupAdvancedScheduleContainer = document.getElementById('group-advanced-schedule-container');
const manageGroupScheduleBtn = document.getElementById('manage-group-schedule-btn');
const scheduleModal = document.getElementById('schedule-modal');
const addScheduleRuleForm = document.getElementById('add-schedule-rule-form');
const scheduleRulesListEl = document.getElementById('schedule-rules-list');
const groupMusicPlaylistSelectEl = document.getElementById('group-music-playlist-select');
const groupScreensListEl = document.getElementById('group-screens-list');
const addGroupModal = document.getElementById('add-group-modal');
const addGroupForm = document.getElementById('add-group-form');
const newGroupNameInput = document.getElementById('new-group-name');
const addGroupCancelBtn = document.getElementById('add-group-cancel');

// State
let currentUserId = null;
let activeGroupId = null;
let getLang = () => 'es';
let getScreens = () => [];
let getPlaylists = () => [];
let getMusicPlaylists = () => [];
let activeGroupData = null;
let listenersAttached = false;

function renderGroupsList(groups) {
    groupsListEl.innerHTML = '';
    groups.forEach(group => {
        const item = document.createElement('div');
        item.className = `p-3 rounded-lg cursor-pointer transition-colors ${group.id === activeGroupId ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'}`;
        item.textContent = group.name;
        item.dataset.groupId = group.id;
        item.addEventListener('click', () => selectGroup(group.id, groups));
        groupsListEl.appendChild(item);
    });
}

function generateGroupScheduleSummary(rules, allVisualPlaylists, allMusicPlaylists, lang) {
    if (!rules || rules.length === 0) {
        return `<p class="text-xs text-center text-gray-400 p-2">${translations[lang].scheduleNoRules}</p>`;
    }

    const daysOfWeek = (lang === 'es') ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    return rules.map(rule => {
        const visualPlaylist = allVisualPlaylists.find(p => p.id === rule.playlistId);
        const musicPlaylist = allMusicPlaylists.find(p => p.id === rule.musicPlaylistId);
        const daysStr = rule.days.map(d => daysOfWeek[d % 7]).join(', ');

        const visualText = visualPlaylist ? visualPlaylist.name : (translations[lang].scheduleNoVisualPlaylist || 'Sin playlist visual');
        const musicText = musicPlaylist ? `🎵 ${musicPlaylist.name}` : '';

        return `<div class="text-xs p-2 bg-white rounded-md border"><p class="font-semibold truncate">${visualText}</p>${musicText ? `<p class="text-gray-500 truncate">${musicText}</p>` : ''}<p class="text-gray-500">${daysStr} | ${rule.startTime} - ${rule.endTime}</p></div>`;
    }).join('');
}

function renderGroupEditor(group) {
    groupEditorTitleEl.textContent = group.name;
    activeGroupData = group; // Guardamos los datos del grupo activo

    // Configurar modo de programación
    const isAdvancedMode = group.schedulingMode === 'advanced';
    groupSimpleScheduleContainer.classList.toggle('hidden', isAdvancedMode);
    groupAdvancedScheduleContainer.classList.toggle('hidden', !isAdvancedMode);
    const simpleRadio = groupEditorEl.querySelector('.group-scheduling-mode-radio[value="simple"]');
    const advancedRadio = groupEditorEl.querySelector('.group-scheduling-mode-radio[value="advanced"]');
    if (simpleRadio) simpleRadio.checked = !isAdvancedMode;
    if (advancedRadio) advancedRadio.checked = isAdvancedMode;

    // Rellenar el resumen de horarios para el modo avanzado
    const summaryContainer = document.getElementById('group-schedule-summary-list');
    summaryContainer.innerHTML = generateGroupScheduleSummary(group.scheduleRules || [], getPlaylists(), getMusicPlaylists(), getLang());

    // Populate playlist selector
    const playlists = getPlaylists();
    groupPlaylistSelectEl.innerHTML = `<option value="">${translations[getLang()].none}</option>`;
    playlists.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === group.playlistId) {
            option.selected = true;
        }
        groupPlaylistSelectEl.appendChild(option);
    });

    // Populate music playlist selector
    const musicPlaylists = getMusicPlaylists();
    groupMusicPlaylistSelectEl.innerHTML = `<option value="">${translations[getLang()].none}</option>`;
    musicPlaylists.forEach(p => {
        const option = document.createElement('option');
        option.value = p.id;
        option.textContent = p.name;
        if (p.id === group.musicPlaylistId) {
            option.selected = true;
        }
        groupMusicPlaylistSelectEl.appendChild(option);
    });

    // Populate screens list with checkboxes
    const screens = getScreens();
    groupScreensListEl.innerHTML = '';
    screens.forEach(screen => {
        const isChecked = group.screens?.includes(screen.id);
        const wrapper = document.createElement('div');
        wrapper.className = 'flex items-center';
        wrapper.innerHTML = `
            <input id="screen-${screen.id}" type="checkbox" ${isChecked ? 'checked' : ''} data-screen-id="${screen.id}" class="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-500">
            <label for="screen-${screen.id}" class="ml-3 block text-sm font-medium text-gray-700">${screen.name}</label>
        `;
        groupScreensListEl.appendChild(wrapper);
    });

    groupEditorEl.classList.remove('hidden');
    groupPlaceholderEl.classList.add('hidden');
}

function selectGroup(groupId, allGroups) {
    activeGroupId = groupId;
    const group = allGroups.find(g => g.id === groupId);
    if (group) {
        renderGroupsList(allGroups);
        renderGroupEditor(group);
    }
}

/**
 * Propaga los cambios de un grupo a todas las pantallas que contiene.
 * @param {string} groupId - El ID del grupo que ha cambiado.
 */
async function propagateGroupChanges(groupId) {
    const groupRef = doc(db, 'groups', groupId);
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) return;

    const groupData = groupSnap.data();
    const screenIds = groupData.screens || [];

    const updatePromises = screenIds.map(screenId => 
        updateDoc(doc(db, 'screens', screenId), { 
            managedByGroup: true,
            // Solo propagamos los campos relevantes del grupo
            playlistId: groupData.playlistId || null,
            musicPlaylistId: groupData.musicPlaylistId || null,
            schedulingMode: groupData.schedulingMode || 'simple',
            scheduleRules: groupData.scheduleRules || []
            // Dejamos intactos los campos 'visualSchedulingMode', 'musicSchedulingMode',
            // 'visualScheduleRules' y 'musicScheduleRules' de la pantalla.
        })
    );
    await Promise.all(updatePromises);
}

export function initGroupsView(userId, langGetter, screensGetter, playlistsGetter, musicPlaylistsGetter, onGroupsUpdate) {
    currentUserId = userId;
    getLang = langGetter;
    getScreens = screensGetter;
    getPlaylists = playlistsGetter;
    getMusicPlaylists = musicPlaylistsGetter;

    if (!listenersAttached) {
        addGroupBtn.addEventListener('click', () => addGroupModal.classList.add('active'));
        addGroupCancelBtn.addEventListener('click', () => addGroupModal.classList.remove('active'));

        addGroupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const groupName = newGroupNameInput.value.trim();
            if (!groupName) return;
            await addDoc(collection(db, 'groups'), {
                userId: currentUserId,
                name: groupName,
                screens: [],
                playlistId: null,
                schedulingMode: 'simple',
                lastScheduledAt: null,
                musicPlaylistId: null,
                createdAt: serverTimestamp()
            });
            newGroupNameInput.value = '';
            addGroupModal.classList.remove('active');
        });

        deleteGroupBtn.addEventListener('click', () => {
            if (!activeGroupId) return;
            showConfirmModal(translations[getLang()].confirmDeleteTitle, `¿Seguro que quieres eliminar este grupo?`, () => {
                deleteDoc(doc(db, 'groups', activeGroupId)).then(() => {
                    activeGroupId = null;
                    groupEditorEl.classList.add('hidden');
                    groupPlaceholderEl.classList.remove('hidden');
                });
            });
        });

        groupPlaylistSelectEl.addEventListener('change', (e) => {
            if (activeGroupId) {
                updateDoc(doc(db, 'groups', activeGroupId), { playlistId: e.target.value || null, lastScheduledAt: serverTimestamp() }).then(() => propagateGroupChanges(activeGroupId));
            }
        });

        groupMusicPlaylistSelectEl.addEventListener('change', (e) => {
            if (activeGroupId) {
                updateDoc(doc(db, 'groups', activeGroupId), { musicPlaylistId: e.target.value || null, lastScheduledAt: serverTimestamp() }).then(() => propagateGroupChanges(activeGroupId));
            }
        });

        // Listeners para el cambio de modo de programación del grupo
        groupEditorEl.querySelectorAll('.group-scheduling-mode-radio').forEach(radio => {
            radio.addEventListener('change', async (e) => {
                if (activeGroupId) {
                    await updateDoc(doc(db, 'groups', activeGroupId), { schedulingMode: e.target.value, lastScheduledAt: serverTimestamp() }).then(() => propagateGroupChanges(activeGroupId));
                }
            });
        });

        // Listener para abrir el modal de horarios del grupo
        manageGroupScheduleBtn.addEventListener('click', () => {
            if (!activeGroupData) return;

            const playlistSelect = document.getElementById('rule-playlist-select');
            const musicPlaylistSelect = document.getElementById('rule-music-playlist-select');

            // Hacemos visibles ambos selectores
            playlistSelect.parentElement.style.display = 'block';
            musicPlaylistSelect.parentElement.style.display = 'block';

            // Llenar el modal con los datos y reglas del GRUPO
            playlistSelect.innerHTML = `<option value="">${translations[getLang()].none}</option>`;
            playlistSelect.innerHTML += getPlaylists().map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            
            musicPlaylistSelect.innerHTML = `<option value="">${translations[getLang()].none}</option>`;
            musicPlaylistSelect.innerHTML += getMusicPlaylists().map(p => `<option value="${p.id}">${p.name}</option>`).join('');

            const daysContainer = document.getElementById('rule-days-checkboxes');
            const daysOfWeek = (getLang() === 'es') ? ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'] : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
            daysContainer.innerHTML = daysOfWeek.map((day, index) => `
                <label class="flex items-center"><input type="checkbox" value="${index + 1}" class="h-4 w-4 rounded border-gray-300"> <span class="ml-2">${day}</span></label>
            `).join('');

            renderGroupScheduleRules(activeGroupData.scheduleRules || []);
            scheduleModal.classList.add('active');
        });

        // Adaptar el formulario del modal para que guarde en el GRUPO
        addScheduleRuleForm.onsubmit = async (e) => {
            e.preventDefault();
            if (!activeGroupId) return;

            const playlistId = document.getElementById('rule-playlist-select').value;
            const musicPlaylistId = document.getElementById('rule-music-playlist-select').value;
            const startTime = document.getElementById('rule-start-time').value;
            const endTime = document.getElementById('rule-end-time').value;
            const days = Array.from(document.querySelectorAll('#rule-days-checkboxes input:checked')).map(cb => parseInt(cb.value));

            if ((!playlistId && !musicPlaylistId) || days.length === 0 || !startTime || !endTime) {
                alert('Por favor, completa los días, horas y al menos una playlist.');
                return;
            }

            const newRule = { playlistId: playlistId || null, musicPlaylistId: musicPlaylistId || null, days, startTime, endTime };
            await updateDoc(doc(db, 'groups', activeGroupId), { scheduleRules: arrayUnion(newRule), lastScheduledAt: serverTimestamp() }).then(() => propagateGroupChanges(activeGroupId));
            addScheduleRuleForm.reset();
        };

        // Adaptar el borrado de reglas para que funcione con el GRUPO
        scheduleRulesListEl.onclick = async (e) => {
            const deleteBtn = e.target.closest('.delete-rule-btn');
            if (deleteBtn && activeGroupId) {
                const ruleIndex = parseInt(deleteBtn.dataset.index);
                const groupRef = doc(db, 'groups', activeGroupId);
                const groupSnap = await getDoc(groupRef);
                const rules = groupSnap.data().scheduleRules || [];
                const ruleToDelete = rules[ruleIndex];
                if (ruleToDelete) await updateDoc(doc(db, 'groups', activeGroupId), { scheduleRules: arrayRemove(ruleToDelete), lastScheduledAt: serverTimestamp() }).then(() => propagateGroupChanges(activeGroupId));
            }
        };

        groupScreensListEl.addEventListener('change', async (e) => {
            if (e.target.type === 'checkbox' && activeGroupId) {
                const screenId = e.target.dataset.screenId;
                const groupRef = doc(db, 'groups', activeGroupId);
                const updateAction = e.target.checked ? arrayUnion(screenId) : arrayRemove(screenId);
                await updateDoc(groupRef, { screens: updateAction });
                
                const screenRef = doc(db, 'screens', screenId);
                // Si se añade la pantalla al grupo, se le aplica la configuración del grupo.
                if (e.target.checked) {
                    const groupSnap = await getDoc(groupRef);
                    const groupData = groupSnap.data();
                    // Marcamos la pantalla para que sepa que está gestionada por un grupo
                    // y le pasamos SOLO la configuración relevante, sin sobreescribir su nombre.
                    await updateDoc(screenRef, { 
                        managedByGroup: true,
                        playlistId: groupData.playlistId || null,
                        musicPlaylistId: groupData.musicPlaylistId || null,
                        schedulingMode: groupData.schedulingMode || 'simple',
                        scheduleRules: groupData.scheduleRules || []
                    });
                } else {
                    // Si se quita del grupo, la pantalla vuelve a su configuración individual.
                    // Reseteamos los campos que heredaba del grupo.
                    await updateDoc(screenRef, { 
                        managedByGroup: false, 
                        // Reseteamos solo los campos que gestionaba el grupo
                        playlistId: null,
                        musicPlaylistId: null,
                        schedulingMode: 'simple', 
                        scheduleRules: [] });
                }
            }
        });

        listenersAttached = true;
    }

    function renderGroupScheduleRules(rules) {
        const lang = getLang();
        const daysOfWeek = (lang === 'es') ? ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'] : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        scheduleRulesListEl.innerHTML = rules.length === 0 ? `<p class="text-gray-500 text-center">No hay reglas de horario.</p>` : '';
        const allVisualPlaylists = getPlaylists();
        const allMusicPlaylists = getMusicPlaylists();
        rules.forEach((rule, index) => {
            const visualPlaylist = allVisualPlaylists.find(p => p.id === rule.playlistId);
            const musicPlaylist = allMusicPlaylists.find(p => p.id === rule.musicPlaylistId);
            const daysStr = rule.days.map(d => daysOfWeek[d % 7]).join(', ');
            const ruleEl = document.createElement('div');
            ruleEl.className = 'bg-white p-3 rounded-md border flex justify-between items-center';
            ruleEl.innerHTML = `
                <div class="flex-grow">
                    <p class="font-semibold">${visualPlaylist ? visualPlaylist.name : 'Sin playlist visual'}</p>
                    <p class="text-sm text-gray-500">${musicPlaylist ? `🎵 ${musicPlaylist.name}` : 'Sin playlist de música'}</p>
                    <p class="text-sm text-gray-600">${daysStr}</p>
                    <p class="text-sm text-gray-600">${rule.startTime} - ${rule.endTime}</p>
                </div>
                <button data-index="${index}" class="delete-rule-btn text-red-500 hover:text-red-700 p-2"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            `;
            scheduleRulesListEl.appendChild(ruleEl);
        });
    }

    const q = query(collection(db, 'groups'), where('userId', '==', userId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        const groups = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.name.localeCompare(b.name)));
        onGroupsUpdate(groups); // Notificamos al script principal
        renderGroupsList(groups);

        if (activeGroupId) {
            const activeGroupData = groups.find(g => g.id === activeGroupId);
            if (activeGroupData) {
                renderGroupEditor(activeGroupData);
            } else {
                activeGroupId = null;
                groupEditorEl.classList.add('hidden');
                groupPlaceholderEl.classList.remove('hidden');
            }
        }
    });

    return { unsubscribe };
}
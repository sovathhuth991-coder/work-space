let activeRightClickDay = "";

function showContextMenu(e, day) {
    activeRightClickDay = day;
    let menu = document.getElementById("customContextMenu");
    if (!menu) {
        menu = document.createElement("div");
        menu.id = "customContextMenu";
        menu.className = "custom-menu";
        menu.setAttribute('role', 'menu');
        document.body.appendChild(menu);
    }
    menu.innerHTML = `<div role="menuitem" onclick="deleteEntireDay()">❌ Clear All Tasks for ${escapeHtml(day)}</div>`;
    menu.style.top = `${e.pageY}px`;
    menu.style.left = `${e.pageX}px`;
    menu.style.display = "block";
}

document.addEventListener("click", () => {
    const menu = document.getElementById("customContextMenu");
    if (menu) menu.style.display = "none";
});

function deleteEntireDay() {
    if (confirm(`Clear your entire schedule for ${activeRightClickDay}?`)) {
        events = events.filter(event => event.day !== activeRightClickDay);
        saveEvents();
        renderSchedule();
        closeDayDiagram();
        showToast(`Cleared all tasks for ${activeRightClickDay}`, 'warning');
    }
}

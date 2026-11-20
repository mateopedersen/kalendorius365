export function connectEventEditor(store, { onChange, announce }) {
  const dialog = document.getElementById("event-dialog");
  const form = dialog.querySelector("form");
  const fields = form.elements;
  const deleteButton = dialog.querySelector("#delete-event");
  const error = dialog.querySelector("#event-error");

  function updateReminderField() {
    const supported = fields.allDay.checked && fields.repeat.value === "none";
    dialog.querySelector("#event-reminder-field").hidden = !supported;
    fields.reminder.disabled = !supported;
  }

  function updateTimeFields() {
    const allDay = fields.allDay.checked;
    dialog.querySelector("#event-times").hidden = allDay;
    for (const input of [fields.startTime, fields.endTime]) {
      input.disabled = allDay;
      input.required = !allDay;
    }
    updateReminderField();
  }

  function open({ id, date, title = "", description = "", category = 0, allDay = false, draftId }) {
    const saved = store.data.events.find((event) => event.id === id);
    form.reset();
    fields.id.value = saved?.id || draftId || "";
    fields.title.value = saved?.title ?? title;
    fields.description.value = saved?.description ?? description;
    fields.startDate.value = saved?.start.slice(0, 10) ?? date;
    fields.endDate.value = saved?.end.slice(0, 10) ?? date;
    fields.startTime.value = saved && !saved.allDay ? saved.start.slice(11) : "09:00";
    fields.endTime.value = saved && !saved.allDay ? saved.end.slice(11) : "10:00";
    fields.allDay.checked = saved?.allDay ?? allDay;
    fields.category.value = saved?.category ?? category;
    fields.repeat.value = saved?.repeat || "none";
    fields.until.value = saved?.until || "";
    fields.reminder.value = saved?.reminder ?? "";
    fields.important.checked = saved?.important || false;
    dialog.querySelector("#event-dialog-title").textContent = saved ? "Redaguoti įvykį" : "Naujas įvykis";
    deleteButton.hidden = !saved;
    error.hidden = true;
    updateTimeFields();
    if (!dialog.open) dialog.showModal();
  }

  function save(change, message) {
    try {
      store.update(change);
      dialog.close();
      onChange();
      announce(message);
    } catch (failure) {
      error.textContent = failure.message;
      error.hidden = false;
    }
  }

  form.addEventListener("submit", (submit) => {
    submit.preventDefault();
    const allDay = fields.allDay.checked;
    const event = {
      id: fields.id.value || crypto.randomUUID(),
      title: fields.title.value.trim(),
      description: fields.description.value,
      allDay,
      start: fields.startDate.value + (allDay ? "" : "T" + fields.startTime.value),
      end: fields.endDate.value + (allDay ? "" : "T" + fields.endTime.value),
      category: Number(fields.category.value),
      repeat: fields.repeat.value,
      until: fields.until.value,
      important: fields.important.checked,
      ...(!fields.reminder.disabled && fields.reminder.value !== "" ? { reminder: Number(fields.reminder.value) } : {}),
    };
    save((data) => {
      const index = data.events.findIndex((item) => item.id === event.id);
      if (index < 0) data.events.push(event);
      else data.events[index] = event;
    }, "Įvykis išsaugotas.");
  });
  deleteButton.addEventListener("click", () => {
    save((data) => {
      data.events = data.events.filter((event) => event.id !== fields.id.value);
    }, "Įvykis ištrintas.");
  });
  fields.startDate.addEventListener("change", () => {
    if (fields.endDate.value < fields.startDate.value) fields.endDate.value = fields.startDate.value;
  });
  fields.allDay.addEventListener("change", updateTimeFields);
  fields.repeat.addEventListener("change", updateReminderField);
  dialog.querySelector("#close-event").addEventListener("click", () => dialog.close());

  return { open };
}

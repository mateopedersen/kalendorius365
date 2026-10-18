import test from "node:test";
import assert from "node:assert/strict";
import { dailySlotIndex, dailySlots, defaultStudioState, validateStudioState, weekDates } from "../site/assets/planner-studio-core.js";

test("weekly plan dates stay calendar dates across leap day and New Year for both week starts", () => {
  assert.deepEqual(weekDates("2028-02-29", 1), ["2028-02-28","2028-02-29","2028-03-01","2028-03-02","2028-03-03","2028-03-04","2028-03-05"]);
  assert.deepEqual(weekDates("2027-01-01", 1), ["2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02","2027-01-03"]);
  assert.deepEqual(weekDates("2027-01-01", 0), ["2026-12-27","2026-12-28","2026-12-29","2026-12-30","2026-12-31","2027-01-01","2027-01-02"]);
});

test("daily time rows support 15 minute boundaries and explicit 24:00", () => {
  assert.deepEqual(dailySlots("23:30","24:00",15), [{dayOffset:0,minutes:1410,label:"23:30"},{dayOffset:0,minutes:1425,label:"23:45"}]);
  assert.equal(dailySlots("08:00","09:00",15).length,4);
  assert.equal(dailySlots("22:00","02:00",60,true).at(-1).label,"01:00");
  assert.throws(() => dailySlots("22:00","02:00",60,false),/Pabaiga/);
  assert.equal(dailySlotIndex({time:"09:45"},"08:00","12:00",60),1);
  assert.equal(dailySlotIndex({time:"01:00"},"22:00","02:00",60,true),3);
  assert.equal(dailySlotIndex({time:"20:00"},"22:00","02:00",60,true),null);
});

test("planner studio validates imported drafts and preserves the selected people and tasks", () => {
  const state = defaultStudioState("family");
  state.people = ["Aš","Tomas","Ema","Bendra"];
  state.tasks = [{day:2,person:1,text:"Muzikos pamoka"}];
  assert.deepEqual(validateStudioState(state,"family").tasks,[{ text:"Muzikos pamoka", day:2, time:"", end:"", endNextDay:false, person:1 }]);
  assert.throws(() => validateStudioState({...state,peopleCount:9},"family"),/nuo 1 iki 8/);
  assert.throws(() => validateStudioState({...state,tasks:[{day:8,person:1,text:"Netinkama diena"}]},"family"),/nepatenka/);
  assert.throws(() => validateStudioState({...state,notes:"x".repeat(1201)},"family"),/per ilgas/);
  assert.throws(() => validateStudioState({...state,layout:"unexpected"},"family"),/maketas/);
  state.tasks = [{ day:2, person:[2,1,2], text:"Bendra išvyka" }];
  assert.deepEqual(validateStudioState(state,"family").tasks[0].person,[2,1]);
  state.tasks = [{ day:2, person:[1], text:"Vienam žmogui" }];
  assert.equal(validateStudioState(state,"family").tasks[0].person,1);
});

test("daily planner rejects incomplete overnight activity times without discarding other valid data", () => {
  const state = defaultStudioState("daily");
  state.tasks = [{ time:"22:00", end:"02:00", endNextDay:true, text:"Naktinė pamaina" }];
  assert.equal(validateStudioState(state,"daily").tasks[0].endNextDay,true);
  assert.throws(() => validateStudioState({...state,end:"24:00"},"daily"),/naudokite 00:00/);
  assert.throws(() => validateStudioState({...state,tasks:[{ time:"23:00", end:"24:00", text:"Netinkamas laikas" }]},"daily"),/pabaigos laikas/);
  assert.throws(() => validateStudioState({...state,tasks:[{ end:"02:00", text:"Be pradžios" }]},"daily"),/pradžią/);
  assert.throws(() => validateStudioState({...state,tasks:[{ time:"22:00", endNextDay:true, text:"Be pabaigos" }]},"daily"),/pabaigos laiką/);
});

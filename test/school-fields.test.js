import test from 'node:test';
import assert from 'node:assert/strict';
import {fillLessonTimes, updateLessonField} from '../site/assets/phase-5-6-8-core.js';

test('school lesson text fields survive serialization alongside valid lesson times',()=>{
 const lesson={day:0,number:1,start:'08:00',end:'08:45',subject:'',room:'',teacher:''};
 updateLessonField(lesson,'subject','Lietuvių kalba');
 updateLessonField(lesson,'room','205A');
 updateLessonField(lesson,'teacher','Ž. Jonaitė');
 const restored=JSON.parse(JSON.stringify({schema:1,lessons:[lesson]})).lessons[0];
 assert.deepEqual(restored,lesson);
 assert.equal(restored.subject,'Lietuvių kalba');
 assert.equal(restored.room,'205A');
 assert.equal(restored.teacher,'Ž. Jonaitė');
 updateLessonField(lesson,'subject','');
 assert.equal(lesson.subject,'','clearing text is a valid saved change');
});

test('invalid lesson times and unknown fields do not overwrite previously saved values',()=>{
 const lesson={start:'08:00',end:'08:45',subject:'Matematika',room:'205A',teacher:'Ž. Jonaitė'};
 const before=structuredClone(lesson);
 for(const [field,value] of [['start','24:10'],['end','08:00'],['start','09:00'],['end','8:5'],['subject','X'.repeat(51)],['__proto__','bad']]) {
  assert.throws(()=>updateLessonField(lesson,field,value));
  assert.deepEqual(lesson,before);
 }
 updateLessonField(lesson,'end','09:00');
 updateLessonField(lesson,'start','08:15');
 assert.equal(lesson.start,'08:15');assert.equal(lesson.end,'09:00');
});

test("generated periods fill blanks without replacing a partly or fully scheduled lesson", () => {
 const existing = {day:0, number:1, start:"08:15", end:"", subject:"Lietuvių kalba", room:"205A", teacher:""};
 const blank = {day:0, number:2, start:"", end:"", subject:"Matematika", room:"202", teacher:""};
 const initial = [existing, blank];
 const plan = fillLessonTimes(initial, {days:[0,1], start:"08:00", duration:45, breakMinutes:10, count:2});
 assert.equal(plan.changed,3);
 assert.deepEqual(plan.lessons.find(l=>l.day===0&&l.number===1),existing);
 assert.deepEqual(plan.lessons.find(l=>l.day===0&&l.number===2),{...blank,start:"08:55",end:"09:40"});
 assert.equal(initial[1].start,"");
 assert.deepEqual(plan.lessons.filter(l=>l.day===1).map(l=>[l.start,l.end]),[["08:00","08:45"],["08:55","09:40"]]);
});

test("period generation rejects overnight and capacity overflows before committing", () => {
 assert.throws(()=>fillLessonTimes([], {days:[0],start:"23:45",duration:45,breakMinutes:0,count:1}),/tą pačią dieną/);
 const lessons = Array.from({length:120}, (_, i) => ({day:Math.floor(i/30),number:i%30+1,start:"08:00",end:"08:45"}));
 assert.throws(()=>fillLessonTimes(lessons, {days:[5],start:"08:00",duration:45,breakMinutes:0,count:1}),/iki 120/);
 assert.equal(lessons.length,120);
});

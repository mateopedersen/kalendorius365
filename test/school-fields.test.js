import test from 'node:test';
import assert from 'node:assert/strict';
import {updateLessonField} from '../site/assets/phase-5-6-8-core.js';

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

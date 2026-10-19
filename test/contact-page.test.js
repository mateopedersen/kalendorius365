import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildContactFormUrl, CONTACT_FORM_URL, CONTACT_TOPICS, safeSourcePage, initializeContactPage } from "../site/assets/contact.js";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("contact URLs always use the published form and allow only the six real topics", () => {
  for (const [topic, label] of Object.entries(CONTACT_TOPICS)) {
    const url = new URL(buildContactFormUrl({ topic, embedded: true }));
    assert.equal(url.origin + url.pathname, CONTACT_FORM_URL);
    assert.equal(url.searchParams.get("entry.122884581"), label);
    assert.equal(url.searchParams.get("embedded"), "true");
  }
  for (const topic of ["__proto__", "constructor", "attacker@example.com", "<script>", ""]) {
    const url = new URL(buildContactFormUrl({ topic }));
    assert.equal(url.searchParams.has("entry.122884581"), false);
    assert.equal(url.origin + url.pathname, CONTACT_FORM_URL);
  }
});

test("source prefill strips private query data, normalizes the host and rejects unsafe URLs", () => {
  assert.equal(safeSourcePage("http://www.kalendorius365.lt/sventes/?q=private#id"), "https://kalendorius365.lt/sventes/");
  assert.equal(safeSourcePage("/apie-mus/"), "https://kalendorius365.lt/apie-mus/");
  for (const value of ["javascript:alert(1)", "https://attacker.example/path", "https://kalendorius365.lt:444/path", "https://user:pass@kalendorius365.lt/", "https://kalendorius365.lt/" + "a".repeat(2050)]) {
    assert.equal(safeSourcePage(value), "");
  }
  const url = new URL(buildContactFormUrl({ topic: "date_error", pageUrl: "https://kalendorius365.lt/apie-mus/?q=private#id", name: "private", email: "private@example.com", message: "private message" }));
  assert.equal(url.searchParams.get("entry.1784264088"), "https://kalendorius365.lt/apie-mus/");
  assert.doesNotMatch(url.href, /private/);
});

test("the rendered integration has a titled Google frame and a direct non-JavaScript fallback", () => {
  const page = read("../site/kontaktai/index.html");
  assert.match(page, /schema_type: ContactPage/);
  assert.match(page, /title="Kalendorius365 kontaktinė forma"/);
  assert.match(page, /referrerpolicy="no-referrer"/);
  assert.ok(page.includes(CONTACT_FORM_URL + "?embedded=true&amp;hl=lt"));
  assert.match(page, /mailto:kalendorius365@gmail\.com/);
  assert.doesNotMatch(page, /data-contact-submit|data-contact-form|laiško juodrašt/);
  assert.match(read("../scripts/build.rb"), /frame-src https:\/\/docs\.google\.com;/);
});

test("privacy source describes Forms storage, Gmail notifications and restricted response access", () => {
  for (const path of ["../site/_includes/privacy-policy-lt.html", "../site/privatumas/index.html"]) {
    const privacy = read(path);
    assert.match(privacy, /Formos atsakymai saugomi „Google Forms“/);
    assert.match(privacy, /pranešimai apie naujus atsakymus siunčiami/);
    assert.match(privacy, /Formos atsakymų suvestinė lankytojams neskelbiama/);
    assert.doesNotMatch(privacy, /forma parengia laiško juodraštį/);
  }
});

test("the external contact application loads once after intent and retains sanitized prefill", () => {
  const requests=[], frameEvents={}, launchEvents={}, attributes={};
  const frame={dataset:{},hidden:true,focusCount:0,focus(){this.focusCount++},getAttribute(name){return attributes[name]||null},setAttribute(name,value){attributes[name]=value},addEventListener(name,handler){frameEvents[name]=handler},set src(value){attributes.src=value;requests.push(value)}};
  const launch={hidden:true,addEventListener(name,handler){launchEvents[name]=handler},setAttribute(name,value){attributes['button-'+name]=value}};
  const loading={hidden:true}, external={};
  const doc={querySelector(selector){return {'[data-contact-frame]':frame,'[data-contact-launch]':launch,'[data-contact-loading]':loading}[selector]||null},querySelectorAll(selector){return selector==='[data-open-contact-form]'?[external]:[]}};
  initializeContactPage(doc,'?tema=date_error&puslapis='+encodeURIComponent('https://kalendorius365.lt/2027/?q=private#note'));
  assert.deepEqual(requests,[]);assert.equal(frame.hidden,true);assert.equal(launch.hidden,false);
  assert.doesNotMatch(frame.dataset.src,/private|note/);assert.equal(new URL(frame.dataset.src).searchParams.get('entry.122884581'),CONTACT_TOPICS.date_error);
  assert.equal(new URL(external.href).searchParams.get('entry.1784264088'),'https://kalendorius365.lt/2027/');
  launchEvents.click();assert.equal(requests.length,1);assert.equal(frame.hidden,false);assert.equal(frame.focusCount,1);assert.equal(loading.hidden,false);assert.equal(attributes['aria-busy'],'true');
  frameEvents.load();assert.equal(loading.hidden,true);assert.equal(attributes['aria-busy'],'false');
  launchEvents.click();assert.equal(requests.length,1);
});

test("contact HTML keeps a direct fallback and does not start the external frame on page load", () => {
  const source=read('../site/kontaktai/index.html');
  assert.doesNotMatch(source,/<iframe\b[^>]*\ssrc=/);
  assert.match(source,/<iframe\b[^>]*\sdata-src="https:\/\/docs\.google\.com/);
  assert.match(source,/data-contact-launch[^>]*hidden/);
  assert.match(source,/data-open-contact-form href="https:\/\/docs\.google\.com/);
});

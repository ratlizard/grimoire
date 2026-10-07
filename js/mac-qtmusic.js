/* mac-qtmusic.js -- QuickTime Musical Instruments, read; and a QTMA tune
   played through them.
   =========================================================================

   WHAT THE GAME SOUNDED LIKE. A QTMA tune holds notes and the instrument each
   part asks for, never a sound. QuickTime played it through QuickTime Musical
   Instruments, a set of 8-bit samples (Roland's "GM/GS Sound Set",
   copyright 1997) in an extension beside QuickTime. So the music as players
   heard it is these samples, and nothing General MIDI plays is it.

   WHICH SET. Two are on the disk, and they differ. QuickTime 2.5's (Mac OS
   7.6) has 61 instruments. QuickTime 3.0's and 4.0's have 235, and they are
   the same 235 byte for byte: the Mac 4.0 copy from the Mac OS 9.0 image
   matched every one inside the Windows 3.0 copy archive.org serves. Cythera
   (1999) came after QuickTime 3, so it is that set this plays. Where the page
   gets it is js/mac-installshield.js's header; how it is read is below.

   THE INSTRUMENTS ARE APPLE'S DOCUMENTED FORMAT, read from QuickTimeMusic.h
   (cythera-reference/apple-documentation/qtma/), not guessed. Each 'ssai'
   resource is a QuickTime atom container: a 12-byte header, then atoms of
   { u32 size, type, u32 id, u16 0, u16 child count, u32 0 } and a body. Its
   root 'sean' holds:
     'tone'  a ToneDescription: the name at +36, instrument and GM number at
             +68 and +72;
     'knbl'  an InstKnobList: count, flags, then { knob, value } pairs, the
             knobs kQTMSKnob* (0x02000000 + n): times in milliseconds,
             levels in 16.16 (65536 is full);
     'sinf'  one per key range, each holding an 'sdsc', an InstSampleDescRec:
             format ('raw ' is 8-bit offset binary), channels, sample size,
             rate 16.16, the sample's id, offset, length, loop type, loop
             start and end, and the key the sample sounds at with the low and
             high keys it covers;
     'smin'  one per sample, id the 'sdsc's sampleDataID, its 'sdat' the PCM.
   The resource id is the instrument number: 1 to 128 the General MIDI
   programs, bank * 128 + program the GS variations, 16384 + n the drum kits.

   WHICH INSTRUMENT A PART GETS. Cythera's tunes ask for GS numbers in banks
   80 and 81 (10455 is bank 81, program 87), which no set has, alongside the
   GM number. QuickTime fell back to the GM number, as far as can be told
   without a recording to compare; the kits (16385, the Standard Kit) are in
   the set as asked. `qtToneInstrument` is that rule.

   THE SYNTHESIS IS OURS, HELD TO QUICKTIME'S WHERE THAT IS READ. Read and
   used: each key range's sample and its own knobs over the instrument's,
   its transpose, root key, loop and rate; the envelope, as the
   synthesizer builds it (QT_ENV, below); the part's volume, pan, pitch
   bend and sustain pedal. Measured, not read: how a note's velocity
   becomes its level (QT_VELOCITY_POWER). Also the synthesizer's: a note
   struck again on its part and key cuts the one before, and with no
   voice free the one furthest gone is taken (QT_VOICES). Not used, and
   each a place it can differ: the volume and pitch LFOs and the mod wheel
   that deepens the pitch one (the tunes send it some 3,300 times),
   exclusion groups, and the output rate and interpolation the Mac used. Reverb is not missing: the synthesizer's
   Reverb setting is off by default, and a voice goes to the reverb bus
   only when it is on and the part's reverb controller is at its
   threshold or over. Controller 33, aftertouch, which the tunes send some
   4,300 times, is not among the fourteen the synthesizer takes.

   Classic script; the page's global scope. */

const QTMS_KNOB = { attack: 1, decay: 2, sustain: 3, keyToDecay: 5, release: 6, transpose: 0x12,
                    sustainTime: 0x1D, sustainInfinite: 0x1E, logCurves: 0x26, velToAttack: 0x3F };
/* THE ENVELOPE IS QUICKTIME'S, read on 6 October 2026 from the QuickTime
   Music extension of QuickTime 4 (the Mac OS 9.0 image; resource 'musk',
   PowerPC, its routines' names in its traceback tables; the workbench's
   GRIMOIRE-NOTES.md has the reading under grimoire/qt-instruments-v56peg).

   StartNoteKeyrange copies the key range's knobs into the voice and calls
   SetADSRStuff with: the attack time times FixPow(knob 0x3F, velocity
   over 128), which the synthesizer calls "Velocity To Attack Time"; the
   decay time times FixPow(knob 5, key over 128), "Key To Decay Time"; the
   sustain level, the sustain time, the release time, and a flag word of
   knob 0x26, "Log Curves", with knob 0x1E, "Infinite Sustain", above it.
   A stage whose bit is set in Log Curves (1 attack, 2 decay, 4 sustain,
   8 release) multiplies the level each step by FixPow(1/65536, step over
   its time): it crosses a factor of 65,536, 96.3 dB, in its time, and a
   decay stops where it meets the sustain level. A stage whose bit is
   clear moves in a straight line. With Infinite Sustain the level holds
   until the key comes up; without, it falls to nothing over the sustain
   time. A voice ends when its level is under 1/65,536. Every instrument
   in the set has Log Curves 14 and Infinite Sustain 1, and a knob an
   instrument leaves out has the default in the synthesizer's 'SSkn'
   resource: decay 1,000 ms, sustain a half, sustain time 5,000 ms,
   release 180 ms, Log Curves 4, both scalings 1.

   Before this the envelope was a guess from the knobs' names: a fall of
   72 dB in the decay time spread to end on the sustain level, the two
   scalings unused, and a kit's note played to its sample's end whatever
   its length. The kit needs no rule of its own: its release is 40 s. */
const QT_ENV = { span: 1 / 65536, floor: 1 / 65536 };
/* HOW LOUD A NOTE IS, where the reading and the recordings disagree. The
   synthesizer takes a note's level as (velocity + 1) / 128 times its
   velocity sensitivity (StartNoteKeyrange; 100 per cent in every
   instrument), and multiplies it by the part's volumes and the envelope,
   all in straight proportion (Serve_This_One). Held to the soundtrack's
   "(Classic)" recordings of the eleven tunes, though, the square of that
   level is nearer than the level itself on every tune, by the spectrum,
   the onsets and the loudness contour, with this envelope as with the
   guessed one (the workbench's tools/qtma-fit/). So something ahead of the
   synthesizer would have to shape velocity, and nothing does: the tune
   player hands NAPlayNote the event's seven bits and the note allocator
   hands MusicPlayNote the same number (both 68K, in the same extension,
   read the same day), and the mixers multiply a sample by the gain and
   shift. So by its code QuickTime is in straight proportion from the
   event to the output, and the recordings are not: either they were not
   made by QuickTime itself (a SoundFont synthesizer playing these same
   samples squares velocity as a matter of course), or something outside
   the three components does it. The square is used because it is what
   the recordings sound like; a capture of the game playing in an
   emulated Mac would settle it. opts.velExp overrides it. */
const QT_VELOCITY_POWER = 2;
/* How many notes sound at once. The synthesizer asks for 14 by default
   ('SSkn': Requested Polyphony, 1 to 48) and then sets its features by the
   machine (SetSynthFeaturesByHardware), so what a given Mac had is not in
   the file. Held to the recordings, a limit of 14 is worse than none on
   three tunes (Seldane's spectrum 0.984 to 0.957) and 24 is the same as
   none, so whatever made the recordings had more than 14; 32 leaves the
   tunes as they are and keeps the rule in play for a denser one. */
const QT_VOICES = 32;
const QT_CUT_FRAMES = rate => Math.max(8, Math.round(rate * 0.004));

/* The resource fork of a QuickTime extension. A Mac file's is its own; a
   Windows .qtx is a small PE image with the fork after its last section. */
function qtxResourceFork(bytes) {
  if (bytes.length > 0x40 && bytes[0] === 0x4D && bytes[1] === 0x5A) {
    const le32 = o => (bytes[o] | (bytes[o + 1] << 8) | (bytes[o + 2] << 16) | (bytes[o + 3] << 24)) >>> 0;
    const pe = le32(0x3C);
    if (bytes[pe] !== 0x50 || bytes[pe + 1] !== 0x45) throw new Error('an MZ file with no PE header');
    const sections = bytes[pe + 6] | (bytes[pe + 7] << 8);
    const opt = bytes[pe + 20] | (bytes[pe + 21] << 8);
    let end = 0;
    for (let i = 0; i < sections; i++) {
      const s = pe + 24 + opt + 40 * i;
      end = Math.max(end, le32(s + 20) + le32(s + 16));
    }
    return bytes.subarray(end);
  }
  return bytes;
}

/* Every atom under [start, end), depth first, each { type, id, start, end, depth }
   with start and end the body's. */
function qtAtoms(bytes, start, end, depth, out) {
  out = out || [];
  depth = depth || 0;
  let o = start;
  while (o + 20 <= end) {
    const size = u32be(bytes, o);
    if (size < 20 || o + size > end) throw new Error('an atom of ' + size + ' bytes at ' + o + ' does not fit');
    const atom = { type: String.fromCharCode(bytes[o + 4], bytes[o + 5], bytes[o + 6], bytes[o + 7]),
                   id: u32be(bytes, o + 8), start: o + 20, end: o + size, depth };
    out.push(atom);
    if (u16be(bytes, o + 14)) qtAtoms(bytes, o + 20, o + size, depth + 1, out);
    o += size;
  }
  return out;
}

/* One 'ssai' resource, read. Its samples may be in another instrument's
   resource: of the 1,544 key ranges in the QuickTime 3 set, the GS
   variations' borrow the base instrument's samples (an 'iref' beside the
   'sdsc' names it), and sample ids are unique across the whole set, so
   `sampleOf(id)` looks one up wherever it is. A key range may carry a 'knbl'
   of its own, which overrides the instrument's: 535 of them carry a whole
   envelope, 319 a transpose (knob 0x12, semitones in 8.8). */
function qtAtomicInstrument(bytes, sampleOf) {
  const atoms = qtAtoms(bytes, 12, bytes.length);
  const s32 = o => u32be(bytes, o) | 0;
  const knobsIn = a => {
    const out = {}, n = u32be(bytes, a.start);
    for (let k = 0; k < n; k++) {
      const id = u32be(bytes, a.start + 8 + 8 * k);
      if ((id & 0xFF000000) === 0x02000000) out[id & 0xFFFF] = s32(a.start + 12 + 8 * k);
    }
    return out;
  };
  const inst = { name: '', number: 0, gm: 0, knobs: {}, regions: [] };
  let region = null;
  for (const a of atoms) {
    if (a.depth === 1 && a.type === 'tone') {
      inst.name = decodeMacRoman(bytes.subarray(a.start + 37, a.start + 37 + bytes[a.start + 36])).trim();
      inst.number = s32(a.start + 68); inst.gm = s32(a.start + 72);
    } else if (a.depth === 1 && a.type === 'knbl') {
      inst.knobs = knobsIn(a);
    } else if (a.depth === 1) {
      region = null;
    } else if (a.depth === 2 && a.type === 'sdsc') {
      const o = a.start;
      region = {
        format: String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]),
        channels: u16be(bytes, o + 4), bits: u16be(bytes, o + 6), rate: u32be(bytes, o + 8) / 65536,
        sampleId: u16be(bytes, o + 12), offset: s32(o + 14), length: s32(o + 18),
        loopType: s32(o + 22), loopStart: s32(o + 26), loopEnd: s32(o + 30),
        root: s32(o + 34), low: s32(o + 38), high: s32(o + 42), knobs: {} };
      inst.regions.push(region);
    } else if (a.depth === 2 && a.type === 'knbl' && region) {
      region.knobs = knobsIn(a);
    }
  }
  for (const r of inst.regions) {
    r.knobs = Object.assign({}, inst.knobs, r.knobs);
    const raw = sampleOf(r.sampleId);
    if (!raw) throw new Error('"' + inst.name + '" names sample ' + r.sampleId + ', which the set does not hold');
    if (r.channels !== 1 || !((r.format === 'raw ' && r.bits === 8) || (r.format === 'twos' && r.bits === 16)))
      throw new Error('"' + inst.name + '" has a ' + r.channels + '-channel ' + r.bits + '-bit \'' + r.format + '\' sample');
    const n = Math.max(0, Math.min(r.length, (raw.length - r.offset) / (r.bits / 8) | 0));
    const pcm = new Float32Array(n);
    if (r.bits === 8) for (let i = 0; i < n; i++) pcm[i] = (raw[r.offset + i] - 128) / 128;
    else for (let i = 0; i < n; i++) pcm[i] = ((raw[r.offset + 2 * i] << 24 >> 16) | raw[r.offset + 2 * i + 1]) / 32768;
    r.pcm = pcm;
  }
  return inst;
}

/* A set of instruments from a resource fork: { ids, has(n), get(n) }.
   Instruments are read the first time one is asked for; the samples' index
   is built across every instrument the first time any is. */
function qtInstrumentLibrary(forkBytes) {
  const fork = openResourceFork(forkBytes);
  const entries = fork.resourcesByType['ssai'] || [];
  if (!entries.length) throw new Error('no instruments (\'ssai\' resources) in this file');
  const byId = new Map(entries.map(e => [e.id, e]));
  const read = new Map();
  let samples = null;
  const sampleOf = id => {
    if (!samples) {
      samples = new Map();
      for (const e of entries) {
        const d = fork.dataOf('ssai', e);
        let smin = null;
        for (const a of qtAtoms(d, 12, d.length)) {
          if (a.depth === 1) smin = a.type === 'smin' ? a.id : null;
          else if (a.depth === 2 && a.type === 'sdat' && smin !== null) samples.set(smin, d.subarray(a.start, a.end));
        }
      }
    }
    return samples.get(id);
  };
  return {
    forkBytes,
    ids: [...byId.keys()].sort((a, b) => a - b),
    has: n => byId.has(n),
    get(n) {
      if (!read.has(n)) read.set(n, byId.has(n) ? qtAtomicInstrument(fork.dataOf('ssai', byId.get(n)), sampleOf) : null);
      return read.get(n);
    }
  };
}

/* The instruments from whatever the visitor or archive.org handed over:
   QuickTime 3's Windows installer (QUICKTIM.EXE), its data.z, the .qtx, or a
   Mac file's resource fork. */
function qtInstrumentsFromFile(bytes) {
  if (bytes[0] === 0x4D && bytes[1] === 0x5A) {
    const dataZ = qtInstallerDataZ(bytes);
    if (dataZ) return qtInstrumentsFromFile(dataZ);
    return qtInstrumentLibrary(qtxResourceFork(bytes));
  }
  if (looksLikeInstallShield3(bytes)) {
    const arc = parseInstallShield3(bytes);
    const e = arc.entries.find(x => /QuickTimeMusicalInstruments\.qtx$/i.test(x.path));
    if (!e) throw new Error('this installer does not hold QuickTimeMusicalInstruments.qtx');
    return qtInstrumentLibrary(qtxResourceFork(installShield3File(bytes, e)));
  }
  return qtInstrumentLibrary(bytes);
}

/* QUICKTIM.EXE is a self-extracting zip whose central directory does not
   agree with where its entries are (7-Zip says the same), so the one entry
   is taken from its local header, which carries the sizes, and held to its
   CRC-32. Returns null for an .exe that holds no data.z. */
function qtInstallerDataZ(exe) {
  const le16 = o => exe[o] | (exe[o + 1] << 8);
  const le32 = o => (exe[o] | (exe[o + 1] << 8) | (exe[o + 2] << 16) | (exe[o + 3] << 24)) >>> 0;
  for (let h = 0; h + 30 < exe.length; h++) {
    if (exe[h] !== 0x50 || exe[h + 1] !== 0x4B || exe[h + 2] !== 3 || exe[h + 3] !== 4) continue;
    const nameLen = le16(h + 26);
    const name = String.fromCharCode(...exe.subarray(h + 30, h + 30 + nameLen));
    if (!/(^|[\\/])data\.z$/i.test(name)) continue;
    const method = le16(h + 8), crc = le32(h + 14), packed = le32(h + 18), len = le32(h + 22);
    const start = h + 30 + nameLen + le16(h + 28);
    let out;
    if (method === 0) out = exe.slice(start, start + len);
    else if (method === 8) out = inflateRaw(exe.subarray(start, start + packed), len, 8);
    else throw new Error('data.z is packed with zip method ' + method);
    if (crc32(out) !== crc) throw new Error('data.z fails its CRC-32');
    return out;
  }
  return null;
}

function qtToneInstrument(lib, tone) {
  if (!tone) return null;
  if (lib.has(tone.instrument)) return lib.get(tone.instrument);
  if (tone.instrument >= 16384 && lib.has(16385)) return lib.get(16385);
  if (tone.gm >= 1 && tone.gm <= 128 && lib.has(tone.gm)) return lib.get(tone.gm);
  return null;
}

/* Play a tune's events (qParseTune's: times and lengths in 1/unitsPerSecond)
   through the instruments. Returns { left, right, rate, missing }: two
   Float32Arrays scaled so the loudest sample is just under full, and the
   parts whose instrument the set does not have. */
function qtmaRender(events, tones, lib, opts) {
  opts = opts || {};
  const rate = opts.rate || 44100, ups = opts.unitsPerSecond || 600;
  const tail = 2;   // seconds after the last note for releases to ring out
  // opts.lastUnit and opts.raw are for rendering one part of a tune on its
  // own, as long as the whole and at the level it has in the whole.
  const lastUnit = opts.lastUnit || events.reduce((m, e) => Math.max(m, e.t + (e.dur || 0)), 0);
  const frames = Math.ceil((lastUnit / ups + tail) * rate);
  const left = new Float32Array(frames), right = new Float32Array(frames);

  const parts = {};
  const missing = [];
  const partOf = p => {
    if (!parts[p]) {
      const inst = qtToneInstrument(lib, tones[p]);
      if (!inst && tones[p]) missing.push(p);
      parts[p] = { inst, volume: 1, pan: 0.5, bend: 0, sustain: false, held: [] };
    }
    return parts[p];
  };

  // Controllers and notes in time order; a note's voice is rendered whole
  // when it starts, reading the part's controllers as they change under it.
  const ctlTimeline = {};
  for (const e of events) if (e.k === 'ctl') (ctlTimeline[e.part] = ctlTimeline[e.part] || []).push(e);
  const fixed = v => (v >= 0x8000 ? v - 0x10000 : v) / 256;
  const stateAt = (p, t) => {
    const s = { volume: 1, pan: 0.5, bend: 0, sustainOffAfter: null };
    let sustainOn = false, susStart = null;
    for (const e of ctlTimeline[p] || []) {
      if (e.t > t) {
        if (sustainOn && e.ctl === 64 && fixed(e.val) <= 0) { s.sustainOffAfter = e.t; break; }
        continue;
      }
      const v = fixed(e.val);
      if (e.ctl === 7) s.volume = Math.max(0, Math.min(127, v)) / 127;
      else if (e.ctl === 10) s.pan = e.val === 0 ? 0.5 : Math.max(0, Math.min(1, v - 1));
      else if (e.ctl === 32) s.bend = v;
      else if (e.ctl === 64) sustainOn = v > 0;
    }
    s.sustainOn = sustainOn;
    return s;
  };
  // Pitch bend changes during a note are followed; the rest are taken at its start.
  const bendSteps = (p, t0, t1) => (ctlTimeline[p] || []).filter(e => e.ctl === 32 && e.t > t0 && e.t < t1);

  const maxVoices = opts.voices || QT_VOICES;
  let voices = [], stolen = 0;
  const notes = events.filter(e => e.k === 'note' && e.vol !== 0).map((e, n) => [e, n]).sort((x, y) => x[0].t - y[0].t || x[1] - y[1]).map(x => x[0]);
  for (const e of notes) {
    const part = partOf(e.part);
    const inst = part.inst;
    if (!inst) continue;
    const region = inst.regions.find(r => e.pitch >= r.low && e.pitch <= r.high)
      || inst.regions.reduce((b, r) => (!b || Math.abs(r.root - e.pitch) < Math.abs(b.root - e.pitch) ? r : b), null);
    if (!region || !region.pcm.length) continue;
    const st = stateAt(e.part, e.t);
    let offUnit = e.t + Math.max(e.dur, 1);
    if (st.sustainOn) offUnit = Math.max(offUnit, st.sustainOffAfter == null ? lastUnit : st.sustainOffAfter);

    /* The envelope, as QuickTime's synthesizer builds it (StartNoteKeyrange
       and SetADSRStuff; the account is over QT_ENV below). The attack's
       time is the knob's times "Velocity To Attack Time" raised to the
       velocity over 128, the decay's the knob's times "Key To Decay Time"
       raised to the key over 128. "Log Curves" says which stages are
       geometric, a bit each from the attack up. */
    const k = region.knobs;
    const knob = (id, dflt) => k[id] === undefined ? dflt : k[id];
    const transpose = (k[QTMS_KNOB.transpose] || 0) / 256;
    const attack = knob(QTMS_KNOB.attack, 0) * Math.pow(knob(QTMS_KNOB.velToAttack, 65536) / 65536, e.vol / 128) / 1000 * rate;
    const decay = knob(QTMS_KNOB.decay, 1000) * Math.pow(knob(QTMS_KNOB.keyToDecay, 65536) / 65536, e.pitch / 128) / 1000 * rate;
    const susLevel = knob(QTMS_KNOB.sustain, 32768) / 65536;
    const susTime = knob(QTMS_KNOB.sustainTime, 5000) / 1000 * rate;
    const susForever = !!knob(QTMS_KNOB.sustainInfinite, 0);
    const release = knob(QTMS_KNOB.release, 180) / 1000 * rate;
    const logs = knob(QTMS_KNOB.logCurves, 4);
    const looped = region.loopEnd > region.loopStart;

    const gain = Math.pow((e.vol + 1) / 128, opts.velExp || QT_VELOCITY_POWER) * Math.pow(st.volume, opts.volExp || 1);
    const pl = Math.cos(st.pan * Math.PI / 2), pr = Math.sin(st.pan * Math.PI / 2);
    const f0 = Math.round(e.t / ups * rate);
    const offFrame = Math.round(offUnit / ups * rate) - f0;
    const steps = bendSteps(e.part, e.t, offUnit).map(c => [Math.round(c.t / ups * rate) - f0, fixed(c.val)]);
    let bend = st.bend, nextStep = 0;
    const stepFor = b => region.rate / rate * Math.pow(2, (e.pitch - region.root + transpose + b) / 12);
    let step = stepFor(bend);

    const pcm = region.pcm, loopLen = region.loopEnd - region.loopStart + 1;
    // A geometric stage multiplies by a constant each frame, a straight
    // one adds a constant; `stage` is 1 attack, 2 decay, 3 sustain,
    // 4 release, as the synthesizer numbers them, and 0 once it is over.
    const fall = n => Math.pow(QT_ENV.span, 1 / Math.max(1, n));
    const decayMul = fall(decay), susMul = fall(susTime), relMul = fall(release);
    const decayAdd = (susLevel - 1) / Math.max(1, decay), susAdd = -susLevel / Math.max(1, susTime);
    const atkMul = Math.pow(1 / QT_ENV.span, 1 / Math.max(1, attack));
    let pos = 0, env = (logs & 1) ? QT_ENV.floor : 0, relAdd = 0, i = 0;
    const v = { part: e.part, pitch: e.pitch, region, born: f0, stage: attack >= 1 ? 1 : 2 };
    if (v.stage === 2) env = 1;
    // Play on to frame `upto` of the tune, or to the voice's end.
    v.run = upto => {
      for (; v.stage && f0 + i < upto; i++) {
        if (nextStep < steps.length && i >= steps[nextStep][0]) { bend = steps[nextStep++][1]; step = stepFor(bend); }
        if (i >= offFrame && v.stage !== 4) { v.stage = 4; relAdd = -env / Math.max(1, release); }
        if (v.stage === 1) {
          env = (logs & 1) ? env * atkMul : env + 1 / attack;
          if (env >= 1) { env = 1; v.stage = 2; }
        } else if (v.stage === 2) {
          env = (logs & 2) ? env * decayMul : env + decayAdd;
          if (env <= susLevel) { env = susLevel; v.stage = 3; }
        } else if (v.stage === 3) {
          if (!susForever) env = (logs & 4) ? env * susMul : env + susAdd;
        } else env = (logs & 8) ? env * relMul : env + relAdd;
        if (env <= QT_ENV.floor && v.stage !== 1) { v.stage = 0; break; }
        let ip = pos | 0;
        if (looped && ip > region.loopEnd) { pos -= loopLen * Math.floor((pos - region.loopStart) / loopLen); ip = pos | 0; }
        if (ip >= pcm.length - 1 && !looped) { v.stage = 0; break; }
        const frac = pos - ip;
        const a = pcm[ip], b = ip + 1 < pcm.length ? pcm[ip + 1] : a;
        const smp = (a + (b - a) * frac) * env * gain;
        left[f0 + i] += smp * pl; right[f0 + i] += smp * pr;
        pos += step;
      }
    };
    // Cut short, as the synthesizer's fast release does within one of its
    // steps: a few milliseconds' straight fall, so the cut does not click.
    v.cut = at => {
      v.run(at);
      const n = Math.min(QT_CUT_FRAMES(rate), frames - at);
      const from = env;
      for (let c = 0; v.stage && c < n; c++) { env = from * (1 - (c + 1) / n); v.runOne(); }
      v.stage = 0;
    };
    v.runOne = () => {
      let ip = pos | 0;
      if (looped && ip > region.loopEnd) { pos -= loopLen * Math.floor((pos - region.loopStart) / loopLen); ip = pos | 0; }
      if (ip >= pcm.length - 1 && !looped) { v.stage = 0; return; }
      if (f0 + i >= frames) { v.stage = 0; return; }
      const frac = pos - ip;
      const a = pcm[ip], b = ip + 1 < pcm.length ? pcm[ip + 1] : a;
      const smp = (a + (b - a) * frac) * env * gain;
      left[f0 + i] += smp * pl; right[f0 + i] += smp * pr;
      pos += step; i++;
    };

    /* The voices, as StartNoteKeyrange takes one. A note struck again on
       its part and key while the last still sounds cuts the last. Then a
       free voice is taken; with none free, the one that scores highest
       goes: one already being cut, then one in its release, then any,
       and the oldest among equals. */
    for (const o of voices) o.run(f0);
    voices = voices.filter(o => o.stage);
    for (const o of voices) if (o.part === v.part && o.pitch === v.pitch && o.region === v.region) o.cut(f0);
    voices = voices.filter(o => o.stage);
    if (voices.length >= maxVoices) {
      let best = voices[0];
      for (const o of voices) {
        const so = o.stage === 4 ? 1 : 0, sb = best.stage === 4 ? 1 : 0;
        if (so > sb || (so === sb && o.born < best.born)) best = o;
      }
      best.cut(f0);
      voices = voices.filter(o => o.stage);
      stolen++;
    }
    voices.push(v);
  }
  for (const o of voices) o.run(frames);

  let peak = 0;
  for (let i = 0; i < frames; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak > 0 && !opts.raw) { const g = 0.95 / peak; for (let i = 0; i < frames; i++) { left[i] *= g; right[i] *= g; } }
  return { left, right, rate, missing, stolen };
}

/* 16-bit stereo WAV bytes from qtmaRender's result. */
function qtmaWav(r) {
  const n = r.left.length;
  const { buffer } = wavHeader(n * 4, r.rate, 16, 2);
  // Little-endian samples straight into the buffer: a DataView call per
  // sample took longer than rendering the tune.
  const pcm = new Int16Array(buffer, 44, n * 2);
  for (let i = 0; i < n; i++) {
    pcm[2 * i] = Math.max(-32768, Math.min(32767, Math.round(r.left[i] * 32767)));
    pcm[2 * i + 1] = Math.max(-32768, Math.min(32767, Math.round(r.right[i] * 32767)));
  }
  return new Uint8Array(buffer);
}

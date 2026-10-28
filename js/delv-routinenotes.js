/* ROUTINE_NOTES: what each routine of the program does, in plain words, by
   class, with the class's opening and each routine's text, keyed by the
   routine's entry (an offset into the code section, as everywhere on the
   site).

   Written by a script, the workbench's tools/fnpublish.py, from its
   doc/functions/, where every claim was read from the instructions twice and
   cites the instructions that show it. Change the words there, not here.
   The page shows a text on the routine's page above its listing, each
   address in it a link that rings the instruction in the visitor's copy of
   the program (renderAppPefSheet, routineNoteHTML). The smoke's routine
   notes block checks that every cited address lies in the routine its text
   is under. Text in backticks is a name or an address, *stars* a title, and
   a line starting "- " an item of a list. */
const ROUTINE_NOTES = {
 "TSegFile": {
  "opening": "One archive file, such as `Cythera Data` or a saved game, open for reading and\nwriting. The object has the file's reference number at `+0`, a byte at `+2`\nthat the object sets when the table of contents changes and clears when it\nwrites the table, a byte at `+3` that is 1 while the file accepts no saves, the\ntime the object opened the file at `+4` (`GetDateTime`, `0x079698`) and from\n`+8` the addresses of 256 pages of the table of contents, 0 for a page not in\nmemory.\n\nThe file starts with a header of 128 bytes. Page 0 of the table follows at\noffset 128, 2,048 bytes (`TSegFile::BlankFile`, `0x079B64` to `0x079B90`). A\npage has 256 entries of 8 bytes, a segment's offset in the file and its length.\nA resource's id picks page `id >> 8` and entry `id & 0xFF` of it\n(`TSegFile::LoadSegment`, `0x079F70` and `0x079F8C`). The file stores page n,\nfrom 1 to 255, as the segment with id n, so entry n of page 0 locates it\n(`TSegFile::LoadTOC`, `0x079C9C` to `0x079D0C`). Entry 0 of page 0 gives the\nplace of page 0 itself, offset 128, and resources from `0x0100` up are the\nfile's contents.",
  "routines": [
   {
    "name": "TSegFile::IsSegFile",
    "entry": 497116,
    "text": "Returns 1 when an open file is an archive, which is when the 4-byte word at\noffset 128, the first entry of page 0, is 128 (`0x079620`), and 0 otherwise."
   },
   {
    "name": "TSegFile::TSegFile",
    "entry": 497268,
    "text": "Opens an archive on a file already open. An empty file becomes a new archive\n(`BlankFile`, `0x0796D0`), and the byte at `+2` goes to 1. For any other file\nit reads the table into memory (`LoadTOC`, `0x0796E8`)."
   },
   {
    "name": "TSegFile::TSegFile",
    "entry": 497460,
    "text": "Makes a new archive at a file location, deleting any file there (`FSpDelete`,\n`0x079770`), creating it with the creator and type given (`FSpCreate`,\n`0x079778` to `0x079788`), opening its data fork for reading and writing\n(`FSpOpenDF`, `0x07979C`) and writing an empty archive (`BlankFile`)."
   },
   {
    "name": "TSegFile::~TSegFile",
    "entry": 497668,
    "text": "Writes the table when it has changed (`SaveTOC`, `0x079834`), closes the file\n(`FSClose`, `0x079840`), frees every page of the table and frees the object when\nthe flag is above 0."
   },
   {
    "name": "TSegFile::Lock",
    "entry": 497920,
    "text": "Sets the byte at `+3` to 1, after which a save throws."
   },
   {
    "name": "TSegFile::Unlock",
    "entry": 497968,
    "text": "Sets the byte at `+3` to 0."
   },
   {
    "name": "TSegFile::DeleteTOCPage",
    "entry": 498020,
    "text": "Frees a page of the table (`free`), unless it is 0."
   },
   {
    "name": "TSegFile::NewTOCPage",
    "entry": 498144,
    "text": "Allocates a page of the table, 2,048 bytes of zeros (`malloc`, `0x0799F4`), and\nthrows \"Could not allocate segfile TOC page\" when there is no memory."
   },
   {
    "name": "TSegFile::BlankFile",
    "entry": 498296,
    "text": "Empties the file (`SetEOF` of 0, `0x079A9C`) and writes a new archive, a header\nof 128 zeros (`0x079B00`) and page 0 of the table with only entry 0, which\ngives page 0's place, offset 128 and length 2,048 (`0x079B64` to `0x079B90`).\nIt returns the File Manager's error, or -108 when there is no memory for the\nheader."
   },
   {
    "name": "TSegFile::LoadTOC",
    "entry": 498656,
    "text": "Reads the table into memory, page 0 from offset 128 (`0x079C38`, `0x079C6C`) and\nthen each page whose entry in page 0 has a length (`0x079C9C` to `0x079D0C`).\nIt reads the entry's length of bytes into a page of 2,048 (`0x079CEC`), so a\nlength above 2,048 would run past the page. It returns the File Manager's\nerror, if any."
   },
   {
    "name": "TSegFile::SaveTOC",
    "entry": 499072,
    "text": "Writes the table. It saves each page from 1 to 255 that has an entry of nonzero\nlength as segment n (`SaveSegment`, `0x079E14`), and frees a page with none and\nclears its entry in page 0 (`0x079E48` to `0x079E90`). Then it writes page 0 at\noffset 128 (`0x079EE4`) and clears the byte at `+2`."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 499532,
    "text": "Reads a whole segment into a buffer, the entry's length of bytes from its\noffset (`FSRead`, `0x079FE0`). The buffer has to be large enough, since nothing\nhere checks it. A resource with no page or a length of 0 gives -50\n(`0x07A008`)."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 499796,
    "text": "Reads part of a segment, a length from an offset into it, into a buffer\n(`0x07A0B8` to `0x07A144`). A missing resource fills the buffer with zeros and\nreturns -43 (`0x07A164`, `0x07A17C`). When the length given is greater than the\nsegment's whole length, it zeros from the buffer's start plus the offset plus\nthe segment's length, for the length given less the segment's length, and\nreads the segment's whole length from the offset (`0x07A0F8` to `0x07A134`).\nWith an offset above 0 that zeroing runs past the buffer's end by the offset,\nand the read goes beyond the segment. When the length given is not greater\nthan the segment's, nothing checks that the offset plus the length stays\ninside the segment. No call in the shipped game meets either case. Every\ncaller but `LoadLevelMap` passes an offset of 0, and `LoadLevelMap`'s reads end\nat the segment's end in the shipped scenario, so only a map edited to be\nshorter than the length in its header would meet it."
   },
   {
    "name": "TSegFile::LoadSegment",
    "entry": 500188,
    "text": "Reads a whole segment into a new handle, from the application heap\n(`NewHandle`, `0x07A238`) or else temporary memory (`TempNewHandle`,\n`0x07A250`). It returns 0 for a missing resource, when there is no memory, or\nwhen the read fails."
   },
   {
    "name": "TSegFile::SetSegmentLen",
    "entry": 500528,
    "text": "Sets a segment's length, making its page when the page is missing. A segment\nthat grows moves to the end of the file, which grows by the new length\n(`GetEOF`, `SetEOF`, `0x07A3D4` to `0x07A434`), and its bytes stay behind,\nuncopied. One that shrinks stays where it is with the new length (`0x07A444` to\n`0x07A458`). Either change sets the byte at `+2`."
   },
   {
    "name": "TSegFile::SaveSegment",
    "entry": 500912,
    "text": "Writes a whole segment. It throws \"Attempt to save segment to locked seg file\"\nwhile the byte at `+3` is 1 (`0x07A4D8` to `0x07A4F8`). A segment longer than\nits entry moves to the end of the file as `SetSegmentLen` moves it (`0x07A578`\nto `0x07A5E4`), one shorter stays where it is, and then the bytes go at the\nentry's offset (`0x07A624`, `0x07A650`). The space a moved segment had stays\nin the file until `Compact`."
   },
   {
    "name": "TSegFile::SaveSegment",
    "entry": 501440,
    "text": "Writes part of a segment, from an offset into it, inside its present length.\nIt throws while the byte at `+3` is 1. It cuts a length running past the\nsegment's end to that end (`0x07A748` to `0x07A760`). For a missing resource or\na length of 0 or less it writes nothing and returns -50 (`0x07A7E4`)."
   },
   {
    "name": "TSegFile::ReadHeader",
    "entry": 501808,
    "text": "Reads the file's 128-byte header from offset 0 into a buffer (`0x07A85C`, `0x07A888`)."
   },
   {
    "name": "TSegFile::WriteHeader",
    "entry": 501996,
    "text": "Writes a buffer of 128 bytes as the file's header at offset 0 (`0x07A918`, `0x07A944`)."
   },
   {
    "name": "TSegFile::Compact",
    "entry": 502184,
    "text": "Rewrites the archive without the space that moved segments left behind. It\nfinds the file (`PBGetFCBInfoSync`, `0x07A9F0`) and makes a copy beside it,\nits name the file's with one of the characters of \"~123456789\" added, the\nfirst such name that no file has (`0x07AA5C` to `0x07AB08`), with creator 'SdEd'\n(`FSpCreate`, `0x07AAC0`). Into the copy it writes the header and every\nsegment from `0x0100` up (`TSegFileIterator`, `0x07AB50`, `SaveSegment` at\n`0x07ABAC`). Then it copies the resource fork (`0x07AC6C` to `0x07ADB8`),\nhalving the buffer until an allocation succeeds. It exchanges the two files\n(`FSpExchangeFiles`, `0x07ADDC`), reopens the original and reads its new table\n(`0x07AE64`, `0x07AE98`), and deletes the copy, which then has the old contents\n(`FSpDelete`, `0x07AED0`). A failure to reopen throws \"Compacting seg file -\ncan't re-open copy\", and a failure to read the table \"Compacting seg file -\ncan't re-load TOC\". When files already have all ten names, it returns -50."
   },
   {
    "name": "TSegFile::Verify",
    "entry": 503972,
    "text": "Checks an open file's archive structure and returns a message, or 0 when it\nfinds nothing wrong. It returns \"Not a segfile\" when the first entry is not 128\n(`IsSegFile`, `0x07B0E4`) and \"Could not read master TOC\" when a read of page 0\nfails. It checks that each entry of page 0 has a length from 0 to 2,048 (\"Bad\nsize of TOC segment\", `0x07B1E0` to `0x07B204`), lies after the header and\ninside the file (\"TOC page out of file\", `0x07B25C` to `0x07B298`) and overlaps\nno other (\"Overlap of TOC segments\", `0x07B328` to `0x07B360`). Then it reads\neach page, returning \"Could not read sub TOC\" when a read fails (`0x07B40C` to\n`0x07B420`), and checks its entries the same way, with the length up to the\nfile's length, returning \"Preposterous size of data segment\", \"data segment\nout of file\" or \"Overlap of data segments\" (`0x07B450` to `0x07B5F0`). It\nstores the id of the entry it finds wrong in the global at toc -29508\n(`0x07B208`, `0x07B494`)."
   },
   {
    "name": "TSegFile::Encrypt",
    "entry": 506416,
    "text": "Enciphers or deciphers bytes in place with a resource's id as the key, the\nsame operation either way. From the id it makes a multiplier, the id times 4,\nlow byte, plus 1 (`0x07BA38`, `0x07BA40`), an increment, the id shifted right 6,\nlow byte (`0x07BA58`), and a starting state, the id with its high byte\nexclusive-ored in (`0x07BA5C`). It steps the state once for each byte to skip,\nthe fourth argument (`0x07BA64` to `0x07BA74`), which every caller passes as 0.\nThen for each byte it steps the state to the increment plus the state times\nthe multiplier and exclusive-ors the byte with the state's low byte\n(`0x07BA7C` to `0x07BA94`)."
   },
   {
    "name": "TSegFile::Decrypt",
    "entry": 506592,
    "text": "Calls `Encrypt` with the same arguments (`0x07BB0C`)."
   },
   {
    "name": "TSegFile::StreamSegment",
    "entry": 507040,
    "text": "Returns a record for reading a segment as a stream, the file's reference\nnumber, the segment's start offset twice (the start and the position to read\nnext) and its end offset (`0x07BCD4` to `0x07BCF4`), with the three offsets 0\nfor a missing resource (`0x07BCFC` to `0x07BD1C`). It builds the record below\nthe stack pointer (`0x07BCD8`), so the caller copies it before its next\ncall."
   }
  ]
 },
 "TCache": {
  "opening": "The memory for copies of resources, one block of the application heap made\ninto a heap zone. The object has its table of virtual routines at `+0`,\nthe block at `+4`, the zone at `+8` and the block used most recently at `+12`,\nthe head of a ring of every block in the zone.\n\nEach block is a handle in the zone with a header of 20 bytes before the data.\nThe header has the address of the owner's pointer at `+0`, which the cache\nsets to the data's address and clears when it frees the block, the handle at\n`+4`, the next older and the next newer block at `+8` and `+12`, a lock count\nat `+16` and flags at `+18`. Bit 0 of the flags means the cache writes the\nblock back before freeing it (`TCache::Free`, `0x07C984`).",
  "routines": [
   {
    "name": "TCache::TCache",
    "entry": 509316,
    "text": "Makes a cache of a size given, allocating the memory (`NewPtr`, `0x07C5BC`) and\nmaking it a zone with 1,024 master pointers (`InitZone`, `0x07C608`,\n`0x07C610`). No memory throws (`0x07C5F4`)."
   },
   {
    "name": "TCache::Allocate",
    "entry": 509556,
    "text": "Allocates a block of a size given for an owner's pointer and returns the data's\naddress. When the zone is full (`NewHandle`, `0x07C6CC`) it frees the oldest\nblock whose lock count is 0 or less and tries again (`0x07C70C` to\n`0x07C770`). It returns 0 when the ring is empty and the allocation still\nfails (`0x07C6E8` to `0x07C6F0`). It throws when every block has a lock count\nabove 0 (`0x07C738`), and nothing reaches the second throw after that one\n(`0x07C750`). The new block goes at the head of the ring as the newest\n(`0x07C7EC` to `0x07C83C`). Then the cache sets every block's owner pointer to\nits data's address again, since a block can have moved (`0x07C840` to\n`0x07C880`)."
   },
   {
    "name": "TCache::GetMyHandle",
    "entry": 510172,
    "text": "Returns the handle of a block from its data's address, the word 16 bytes before it, or 0 for 0."
   },
   {
    "name": "TCache::WriteBlock",
    "entry": 510240,
    "text": "Does nothing. `Free` calls it, as the virtual routine at offset 8, for a block with bit 0 of its flags set."
   },
   {
    "name": "TCache::Free",
    "entry": 510288,
    "text": "Frees a block by its data's address. For a block with bit 0 of its flags set it\nfirst calls the virtual routine at offset 8 (`0x07C9A0`). The block leaves the\nring, the cache clears its owner's pointer (`0x07CA04`) and disposes of the\nhandle (`0x07CA0C`). With the third argument set, the cache then sets every\nother block's owner pointer to its data's address again (`0x07CA2C` to\n`0x07CA60`)."
   },
   {
    "name": "TCache::Lock",
    "entry": 510624,
    "text": "Adds 1 to a block's lock count and locks its handle (`HLock`, `0x07CAE0`), so that `Allocate` passes it over."
   },
   {
    "name": "TCache::Unlock",
    "entry": 510760,
    "text": "Subtracts 1 from a block's lock count and unlocks its handle when the count reaches 0 (`HUnlock`, `0x07CB7C`)."
   },
   {
    "name": "TCache::Touch",
    "entry": 510920,
    "text": "Moves a block to the head of the ring as the newest (`0x07CC00` to `0x07CC70`),\nso that the cache frees it last. A null block (`0x07CBE0`) and the block already\nat the head (`0x07CBF8` to `0x07CBFC`) return at once, so a lone block never\nleaves the ring. When the ring was empty on entry, which means the block was in\nno ring (`0x07CC24` to `0x07CC2C`), it calls `DebugStr` with \"Touching a block\nnot in the cache\" (`0x07CC34`) and makes the block the only one."
   }
  ]
 },
 "TCachedSegFiles": {
  "opening": "The archives open at once, merged into one table, with a cache of the\nresources read from them. The scenario's `Cythera Data` and the saved game are\ntwo of them. The object has the cache (`TCache`) at `+0`, up to 16 open\narchives (`TSegFile`) from `+4`, the newest first, and from `+68` the\naddresses of 256 pages of the merged table. A page has 256 entries of 8 bytes,\nthe address of the resource's copy in the cache (0 for none) and the\nresource's source archive, with the id picking the entry as in `TSegFile`.\n\nEvery save goes to the newest archive, at `+4` (`TCachedSegFiles::SaveSegment`,\n`0x07D75C`). The program reaches the one object through the global at toc\n-30396.",
  "routines": [
   {
    "name": "TCachedSegFiles::TCachedSegFiles",
    "entry": 511148,
    "text": "Makes the object for a cache given, with no archives and an empty table."
   },
   {
    "name": "TCachedSegFiles::AddFile",
    "entry": 511312,
    "text": "Adds an archive as the newest. The others move down one place, and a\nsixteenth falls off the list (`0x07CD78` to `0x07CD9C`). Then it points every\nresource from `0x0100` up that the archive has at the archive (`SetEntry`,\n`0x07CDDC`), so each resource's source is the newest archive that has it."
   },
   {
    "name": "TCachedSegFiles::NewTOCPage",
    "entry": 511568,
    "text": "Allocates a page of the merged table, 2,048 bytes of zeros (`malloc`, `0x07CE6C`), and throws when there is no memory."
   },
   {
    "name": "TCachedSegFiles::SetEntry",
    "entry": 511776,
    "text": "Points a resource at an archive, making its page when the page is missing.\nWhen the archive differs from the entry's, it frees the resource's copy in the\ncache (`TCache::Free`, `0x07CFAC`). When the archive matches, a copy in the\ncache stays as it is (`0x07CF88`)."
   },
   {
    "name": "TCachedSegFiles::GetSegment",
    "entry": 512012,
    "text": "Returns the address of a resource's copy in the cache, reading the resource in\nfirst when there is no copy. It makes a copy already there the newest\n(`TCache::Touch`, `0x07D05C`). Otherwise it allocates a block of the resource's\nlength (`TCache::Allocate`, `0x07D0D0`) and reads the resource into it as the\nfile has it (`TSegFile::LoadSegment`, `0x07D0E4`). It returns 0 for a\nresource no archive has."
   },
   {
    "name": "TCachedSegFiles::GetEncryptedSegment",
    "entry": 512328,
    "text": "Returns the address of a resource's deciphered copy in the cache. It does what\n`GetSegment` does and then deciphers the bytes it read (`TSegFile::Decrypt`,\n`0x07D238`). It returns a copy already in the cache as it is, so the copy has\ndeciphered bytes only when this routine, rather than `GetSegment`, read it in\nfirst."
   },
   {
    "name": "TCachedSegFiles::GetSegmentLength",
    "entry": 512676,
    "text": "Returns a resource's length in its source archive, or 0 for a resource no archive has."
   },
   {
    "name": "TCachedSegFiles::Exists",
    "entry": 512904,
    "text": "Returns 1 when a resource's source archive has an offset for it other than 0\n(`0x07D3FC`), and 0 otherwise."
   },
   {
    "name": "TCachedSegFiles::LoadSegment",
    "entry": 513112,
    "text": "Copies a whole resource into a buffer. It moves a copy in the cache into the\nbuffer (`BlockMove`, `0x07D4FC`) and then reads the resource from its archive\ninto the same buffer (`TSegFile::LoadSegment`, `0x07D568`), so the buffer ends\nwith the bytes as the file has them."
   },
   {
    "name": "TCachedSegFiles::LoadSegment",
    "entry": 513468,
    "text": "Copies part of a resource, from an offset, into a buffer, first from the\ncache (`BlockMove`, `0x07D624`) and then from its archive\n(`TSegFile::LoadSegment` at `0x07A054`, called at `0x07D64C`)."
   },
   {
    "name": "TCachedSegFiles::SetSegmentLen",
    "entry": 513696,
    "text": "Sets a resource's length in the newest archive (`TSegFile::SetSegmentLen`, `0x07D6D8`) and points the resource at that archive (`SetEntry`, `0x07D6EC`)."
   },
   {
    "name": "TCachedSegFiles::SaveSegment",
    "entry": 513856,
    "text": "Writes a whole resource to the newest archive (`TSegFile::SaveSegment`, `0x07D780`) and points the resource at it (`SetEntry`, `0x07D794`)."
   },
   {
    "name": "TCachedSegFiles::SaveSegment",
    "entry": 514024,
    "text": "Writes part of a resource to the newest archive (`TSegFile::SaveSegment` at `0x07A6C0`, called at `0x07D830`) and points the resource at it (`SetEntry`, `0x07D844`)."
   },
   {
    "name": "TCachedSegFiles::SaveEncryptedSegment",
    "entry": 514200,
    "text": "Writes a resource enciphered to the newest archive. It enciphers the bytes in\nplace (`TSegFile::Encrypt`, `0x07D8E0`), writes them (`0x07D8F8`), deciphers\nthem again (`0x07D910`) and points the resource at that archive (`SetEntry`,\n`0x07D924`)."
   },
   {
    "name": "TCachedSegFiles::RefindSegment",
    "entry": 514440,
    "text": "Looks again for the source archive of a resource. It frees the cached copy\nof entry 0 of the resource's page, not the resource's entry (the load\nat `0x07D9BC`, `TCache::Free` at `0x07D9D4`), and clears the resource's\narchive (`0x07D9F0`). Then it goes through the archives from the newest\n(`0x07D9FC` to `0x07DA94`) and points the resource at each one that has it,\nwithout stopping, so it ends at the oldest that has it. The resource's\ncopy in the cache stays."
   },
   {
    "name": "TCachedSegFiles::Flush",
    "entry": 514788,
    "text": "Writes the newest archive's table when it has changed (`TSegFile::SaveTOC`,\n`0x07DB1C`), and otherwise flushes the file (`PBFlushFileSync`,\n`0x07DB34`)."
   },
   {
    "name": "TCachedSegFiles::RemoveFile",
    "entry": 514948,
    "text": "Removes an archive from the list, moving the later ones up (`0x07DBAC` to\n`0x07DBFC`). When the archive is not in the list, the routine ends there\n(`0x07DC00`, `0x07DC04`). The last slot is not cleared and still has its old\nvalue. For each resource whose source it was and that has a copy in the\ncache, it frees the copy and clears the source (`0x07DC40` to `0x07DC78`). A\nresource with no copy in the cache still points at the removed archive. Then\nit points every resource of every remaining archive at that archive, from the\noldest to the newest (`SetEntry`, `0x07DD0C`), which leaves each resource that\nanother archive has with the newest of those as its source. The walk starts at\nthe last slot (`0x07DCA0`), so when the list was full and the removed archive\nwas the last, the resources that only it has point at it again."
   },
   {
    "name": "TCachedSegFiles::HomeSegFile",
    "entry": 515468,
    "text": "Returns a resource's source archive, or 0."
   }
  ]
 },
 "TInterp": {
  "opening": "The interpreter of the game's scripts, the byte code in `Cythera Data` that\ngrimoire's script view disassembles, with the mnemonics of its opcode table\n(`DVM_OPS` in `js/delv-script.js`). One object runs one script resource. It has\nthe arguments' base on the value stack at `+0`, the locals' base at `+4`, the\nscript's deciphered bytes at `+8` and the resource's id at `+12` (the\nconstructor, `0x0833C0`).\n\nValues are `VAddr` words, with their types in `VAddr`. The value stack is one\narray for all interpreters, its base in the global at toc -29440 and its depth\nin the halfword at toc -29444 (`data+0x72750`). True, False and None are the\nwords in the globals at toc -29844, -29712 and -30416. A pending exception is\nthe pointer in the global at toc -29436. While that pointer is not 0, both\nroutines that read opcodes return at their next opcode (`DoExpr`, `0x07DE4C`,\nand `DoInterpAt`, `0x080D78`), and the interpreter's destructor throws the\nexception (`0x083544`).\n\nThe interpreter evaluates expressions in one routine (`DoExpr`) and runs\nstatements in another (`DoInterpAt`). Expression opcodes 0x40 to 0x9F go\nthrough a jump table at toc +5236 (`0x07DE78`), and statement opcodes through a\nchain of compares (`0x080DD8`). A system call is opcode 0xA0 up, entry `opcode -\n0xA0` of a table of 96 routine pointers at toc +8176 (`0x0806D0`), from\n`RangeIter` (0xA0) to `cbDebugStr` (0xFE), each with its name in the program.",
  "routines": [
   {
    "name": "TInterp::DoExpr",
    "entry": 515580,
    "text": "Evaluates one expression, pushing its value onto the value stack. It reads\nopcodes from the program counter its second argument points at until the\nexpression ends (opcode 0x40, `0x07DE8C`). The opcodes do as follows.\n\n- Opcodes 0x00 to 0x2F push a local, from `+4` (`0x080620`), and 0x30 to 0x3F\n  push an argument, from `+0` (`0x08066C`).\n- The `byte` and `short` opcodes push a constant of 28 bits (`0x07DF20`). The\n  `word` opcode pushes the whole 4-byte word inline in the script, its type\n  bits included (`0x07DF50` to `0x07DFD4`). For a `word` of type 1 the routine\n  adds the value stack's frame to its low 16 bits (`0x07DF84` to `0x07DFB0`).\n- The `string` and `data` opcodes push a far address to the bytes inline in\n  the script, and skip them (`0x07DFE8`, `0x07E07C`).\n- The `load_far_word` opcode reads the 4-byte word at a resource and an offset,\n  through `TCachedSegFiles::GetEncryptedSegment` (`0x07E170`, `lwzx` at\n  `0x07E1BC`), and throws \"Can't fetch global from segment\" when the segment is\n  missing. The `load_near_word` opcode reads a word of the current script\n  (`0x07E318`).\n- The `global` opcode pushes `GetGlobal` of its number (`0x07E2B0`).\n- The `index` opcode pushes `At` of an object and an index, or None when the\n  index, the value popped first, is not a number (`0x07E398` to `0x07E3A4`,\n  `0x07E3F8`).\n- The `has_member` opcode pushes True when the object is a game object (type 4)\n  whose class answers the method, through `Dispatch` (`0x07E4B8`), and False\n  otherwise. The `class_member` opcode pushes what the class has under that\n  number.\n- The `get_field` opcode reads a game object's field through `GetField`\n  (`0x07E6EC`). The `cast` opcode turns a number into a reference to an object\n  of the type given, and converts another object through `Ctor` (`0x07E86C`).\n  The `is_type` opcode pushes True for a game object of that class.\n- The `add` and `sub` opcodes work on numbers, add a number to a game object's\n  id or a type-3 value's low 12 bits (`0x07F36C`, `0x07F3EC`), and push the\n  left value for any other pair. The `div` and `mod` opcodes give 0 when\n  dividing by 0 (`0x07F8E0`). The comparisons give True or False for two\n  numbers and push the left value for any other pair (`0x07FB1C`, `0x07FB84`).\n  The `eq` and `ne` opcodes compare through `IsEqual` (`0x07FF6C`).\n- The `gui` opcode with 0 converts a value. With a number n it evaluates its\n  arguments and makes a scripted window object through `CreateSysObj`\n  (`0x07EA7C`).\n- The `call_subroutine` opcode runs a routine of the same script (`DoInterpAt`,\n  `0x07EB54`), and the `call_resource` opcode a whole script in a new\n  `TInterp` (`0x07EBF4`). The `call_index` opcode runs the routine a value\n  points at, a script (type 6) or a far address into one.\n- The `method` opcode sends a method to the object that is its first\n  argument. A game object runs its class's script for the method, through\n  `Dispatch` (`0x07F084`), or the default script, resource `0x3000` plus the\n  method's number (`0x07F108`), when its class has none. A system object goes\n  to `DispatchSysObj` (`0x07F004`) and a heap object to `DispatchHeapObj`\n  (`0x07F1D8`). Any other value is the result itself (`0x07F254`).\n- Opcodes 0xA0 and up are the system calls (`0x0806E4`).\n\nAny other opcode throws \"Bad expr opcode\" (`0x080780`)."
   },
   {
    "name": "TInterp::IsTrue",
    "entry": 526692,
    "text": "Returns whether a value counts as true in a condition. True, a number other\nthan 0, a game object (type 4), a type-2 or type-3 value and a far address are\ntrue. False, None, 0 and every other type, a heap object (type 7) among them,\nare false (`0x080A08` to `0x080AA8`)."
   },
   {
    "name": "TInterp::IsEqual",
    "entry": 527068,
    "text": "Returns whether two values are equal. When both are strings (`IsString`) it\ncompares their text (`strcmp`, `0x080B3C`). Otherwise it compares the words."
   },
   {
    "name": "TInterp::DoInterpAt",
    "entry": 527512,
    "text": "Runs the statements of a script from an offset until a `return`, an `exit` or\na pending exception, and stores the result through its first argument. The\nstatements do as follows.\n\n- The `subroutine` statement opens a routine, reserving its locals on the\n  value stack (`0x080ED0`).\n- The `set_local` statement writes a local or an argument (`0x080F40`,\n  `0x080FA8`). The `write_near_word` statement writes a word of the script in\n  memory, and nothing saves it (`0x081178`). The `write_far_word` statement\n  writes the 4-byte word at a resource and an offset in the deciphered copy and\n  saves the resource enciphered to the most recently added archive\n  (`0x080FB0`, `stwx` at `0x081088`, `SaveEncryptedSegment` at `0x0810B0`). For\n  a missing resource it throws \"Can't set global in segment\" (`0x0810F4`).\n- The `set_index` statement stores through `AtPut` only for a number from 0\n  below the object's length (`0x081214` to `0x081278`), so it never makes a\n  list longer. The `set_field` statement writes a game object's field\n  (`SetField`, `0x08132C`) and the `set_global` statement a global\n  (`SetGlobal`, `0x081388`).\n- The `branch` statement jumps to an offset (`0x0813D8`). The `switch`\n  statement jumps through a table of offsets for a number from 0 below the\n  table's count, and past the table for any other value (`0x081434` to\n  `0x081498`).\n- The `if` statement jumps to its target when the condition is true. The\n  `if_not` statement runs what follows when the condition is true and jumps to\n  its target when it is false (`IsTrue`, `0x0818F0` and `0x081990`).\n- The `print` statement writes a value to the message pane, a number by \"%d\",\n  True, False and None as \"true\", \"false\" and \"None\", a game object by\n  `PrintObj`, and a global string or a string as its text, through\n  `HandleMapping` and `OutStr` (`0x081504` to `0x081750`). A byte below 0x80\n  in place of a statement starts text to print in the same way (`0x082368`).\n- The `return` statement stores its value as the result and ends the routine\n  (`0x0817C8`).\n- The `exit` statement calls the conversation object's virtual routines at\n  offsets 260 and 276, the second with the input's 64 bytes (`0x081A04` to\n  `0x081A28`), and puts \"bye\" in the input when it is still empty (`0x081A30`\n  to `0x081A44`). The `conversation_prompt` statement reads a prompt's text\n  (`0x081A5C`). For a prompt starting with `*` the player types a line into the\n  input through routine 276 (`0x081AA4`). Any other prompt goes to routine 280,\n  and the one character that routine returns becomes the input (`0x081AD4` to\n  `0x081B04`). The `conversation_response` statement jumps to its target when\n  the input starts with one of its comma-separated keywords, or the keyword is\n  `*` (the runtime's `strncmp`, called at `0x081BA4`). It skips no space after\n  a comma, so a keyword written after \", \" needs a space typed first. Parium's,\n  Crito's and Apis's lists, \"inn, pari\", \"inn, crit\" and \"inn, apis\", are such\n  lists.\n- The `ai_state` statement makes an exception of 16 bytes, with \"Raise\", the\n  state's number and a value, and sets it pending (`0x081C64` to `0x081CB8`).\n  The interpreter then returns at its next opcode, and its destructor throws\n  the exception. The `gui_close` statement releases a heap object or deletes a\n  system object (`0x08184C`, `0x0818AC`).\n- The calls run as in `DoExpr`, and the routine drops the result. A system\n  call as a statement works the same way (`0x0823EC`).\n\nAny other opcode throws \"Bad statement opcode\" (`0x082464`). An exception\nthat passes through lands in one of three handlers, and no branch leads to\nany of them. The exception table is not read, so the type each one catches is\nnot known. The first sets the value stack back to the routine's frame and\nthrows a new exception of the type at toc -26032, with word `+4` of the\ncaught one in it (`0x082470` to `0x0824EC`). The second sets the stack back and\ngives None (`0x0824F8` to `0x08255C`). The third gives None and leaves the\nstack where it was (`0x082560` to `0x082580`)."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534104,
    "text": "Runs a method of an object with no arguments, pushing the object and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534260,
    "text": "Runs a method of an object with one argument, pushing both and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534472,
    "text": "Runs a method of an object with two arguments, pushing all three and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterp",
    "entry": 534724,
    "text": "Runs a method of an object with four arguments, pushing all five and calling `DoInterp0`."
   },
   {
    "name": "TInterp::DoInterpRoutine",
    "entry": 535052,
    "text": "Runs a whole script resource from its start with three arguments, in a new\n`TInterp` (`0x082AA0`, `DoInterpAt` at `0x082AC4`)."
   },
   {
    "name": "TInterp::DoInterp0",
    "entry": 535348,
    "text": "Runs a method of an object whose arguments are on the value stack, as the\n`method` opcode does, through a game object's class script, the default script\n`0x3000` plus the method (`0x082C4C`), `DispatchSysObj`, or `DispatchHeapObj`.\nIt also runs a far address as a routine at that offset (`0x082D7C`) and a\ntype-6 value as a whole script (`0x082E34`). Any other value gives None."
   },
   {
    "name": "TInterp::Dispatch",
    "entry": 536284,
    "text": "Looks up a method in a class's script. It deciphers the class script\n(`GetEncryptedSegment`, `0x082F04`), whose first halfword is the offset of its\ntable of methods, and returns 1 with the entry for the method (`At`,\n`0x082F40`) when it is not None, and 0 otherwise or when the class has no\nscript."
   },
   {
    "name": "TInterp::GetString",
    "entry": 536496,
    "text": "Copies text from a script into a buffer, up to a zero byte or a byte of 0x80 or\nabove, which is where the next opcode starts (`0x082FD4`), and returns the\naddress after it."
   },
   {
    "name": "TInterp::VAddrToPtr",
    "entry": 536604,
    "text": "Returns a pointer for a value, by its type through a jump table at toc +5620\n(`0x083080`). A far address points into its deciphered segment (`0x0830A4`). A\nframe reference points into the value stack (`0x0830C4`). An element of an\narray in a script resource points at that element. A global string comes from\n`GetGlobStr`. A game object gives its name (`SysObjToString`, or its method 2,\n`0x0831D8`). A heap string gives its characters. True, False and None give\n\"True\", \"False\" and \"None\" (`0x083258` to `0x0832A4`), where `print` writes\n\"true\" and \"false\". Any other value throws."
   },
   {
    "name": "TInterp::TInterp",
    "entry": 537532,
    "text": "Makes an interpreter for a script resource. It deciphers the script\n(`GetEncryptedSegment`, `0x083400`) and locks it in the cache while the object\nlives (`TCache::Lock`, `0x08341C`), sets the frame to the top of the value\nstack, and discards any pending exception (`0x083460` to `0x083484`)."
   },
   {
    "name": "TInterp::~TInterp",
    "entry": 537808,
    "text": "Unlocks the script (`TCache::Unlock`, `0x083508`). When an exception is\npending it throws a new exception of the type at toc -26064, with word `+4`\nof the pending one in it (`0x083520` to `0x083544`), which is how a raise\nleaves the routine that ran the script."
   },
   {
    "name": "TInterp::Len",
    "entry": 538028,
    "text": "Returns a value's length, 0 for a number, a heap object's length, a game\nobject's answer to method 3 (`0x083684`, `0x0836AC`), an array's count in a\nscript resource, or a string's `strlen`."
   },
   {
    "name": "TInterp::At",
    "entry": 538520,
    "text": "Returns the element at an index, through a game object's method 4\n(`0x083864`, `0x08388C`), a heap object's `At` (`0x0838E4`), or the byte of a\nstring or the element of an array in a script resource. A number comes back\nas itself (`0x0837BC` to `0x0837C8`), and None gives None (`0x0837D0` to\n`0x0837E4`)."
   },
   {
    "name": "TInterp::AtPut",
    "entry": 539316,
    "text": "Stores a value at an index, through a heap object's `AtPut` (`0x083B48`), a\ngame object's method 5 (`0x083BD4`, `0x083C00`), or, for an array in a script\nresource, the word at the index in memory, with no check of the index against\nthe array's count (`0x083C58`). The `set_index` statement checks the length\nfirst. A number or None stays as it is."
   },
   {
    "name": "TInterp::HasProperty",
    "entry": 540472,
    "text": "Returns the entry a class's script has for a method or property, through `Dispatch`, or None."
   },
   {
    "name": "TInterp::GetProperty",
    "entry": 540648,
    "text": "Returns the element at an index of what a class's script has under a number (`Dispatch`, then `At`, `0x084048`), or None."
   },
   {
    "name": "TInterp::IsString",
    "entry": 605716,
    "text": "Returns the characters of a value that is a string, or 0. A far address or\ntype-3 value whose bytes are text, a heap string (`0x093F04`) and global\nstrings 1, 2 and 10 (`GetGlobStr`, `0x093F14` to `0x093F40`) are strings. It\nreturns 0 for numbers and every other value."
   }
  ]
 },
 "TStyleRun": {
  "opening": "One run of text in a single style, a node of the list that a `TTextContext`\nbuilds, 20 bytes. It has the run's x on its line at `+0` (a short, 0 for the\nfirst run of a line), its width in pixels at `+2`, its text style (an index for\n`SetText`) at `+4`, a byte at `+6` that is 1 for a highlighted keyword, a byte\nat `+7` that is 1 when the keyword's word goes on into the next run, the text's\naddress at `+8`, its length at `+12` and the next run at `+16`.",
  "routines": [
   {
    "name": "TStyleRun::TStyleRun",
    "entry": 482232,
    "text": "Makes the first run of a text, at x -1, in style 5, not highlighted and empty (`0x075BB8` to `0x075BF4`)."
   },
   {
    "name": "TStyleRun::TStyleRun",
    "entry": 482340,
    "text": "Makes a run after another one, copying its 20 bytes, linking itself in after\nit (`0x075C50`) and starting at the text address given with a length of 0\n(`0x075C54`, `0x075C58`)."
   },
   {
    "name": "TStyleRun::Draw",
    "entry": 482452,
    "text": "Draws the run at a line's position, in its style (`SetText`, `0x075CBC`). With\nthe text color 33 (black) it draws plain text (`AADrawText`, `0x075D1C`), in the\nhighlight color when the run is a keyword (`0x075CC8` to `0x075CD8`). With any\nother color it draws the text with a shadow (`TTextContext::DrawTextOutlined`,\n`0x075D54`), in the highlight color for a keyword and with a black\nshadow."
   }
  ]
 },
 "TTextContext": {
  "opening": "A text laid out in lines for drawing from the game's markup, such as the text\nof a conversation, a message or a scripted window. The object has the width at\n`+0`, the first `TStyleRun` at `+4` and at `+8` one block with every run's\ncharacters. A run whose x is 0 starts a line.",
  "routines": [
   {
    "name": "TTextContext::TTextContext",
    "entry": 482712,
    "text": "Lays out a text. Its arguments are the text and its length, the width in\npixels, a base text style and a word of flags. It reads the markup into runs as\nfollows.\n\n- A carriage return or a line feed starts a new line (`0x075E40` to\n  `0x075E98`).\n- An `@` makes the next word a keyword, a highlighted run (`0x075EA4` to\n  `0x075EE8`), until the first character that is not a letter. That character\n  starts a plain run, and a byte at its `+7` records that the word goes on\n  when the character is not a space, a line break or 0 (`0x075EF8` to\n  `0x075FBC`).\n- A `<` followed by a digit d switches to text style base + 5 + 3 × d, a `<`\n  with no digit to base + 8 (`0x075FCC` to `0x076064`), and a `>` back to base\n  + 5 (`0x076074` to `0x0760B8`).\n- An `&` followed by a digit n, or none for 1, opens a section, and the next `&`\n  closes it (`0x0760C0` to `0x076188`). The section shows when bit n of the\n  flags is 1 and hides otherwise (`0x07611C` to `0x07616C`). Text outside any\n  section shows unless bit 0 is 1 (`0x075E08` to `0x075E2C`). The closing `&`\n  hides the text after it when bit 0 is 1 (`0x076174` to `0x076184`) and\n  otherwise leaves it as the section was, so after a hidden section the text\n  stays hidden until a section that shows. Every call but one passes flags\n  of 0, so in those an `&` hides the rest of the text. In a run of the game\n  the book Aloiphos B stops after \"lapis lazuli\" of \"lapis lazuli & jasper\",\n  and Eurybates's \"I'm the cook & hunter for the camp.\" after \"I'm the cook\".\n\nIt then measures each run (`TextWidth`, `0x0761EC`), copies every run's\ncharacters into one block (`NewPtr`, `BlockMoveData`, `0x076234` to\n`0x076270`) and breaks the runs into lines no wider than the width\n(`StyledLineBreak`, `0x07633C`). A keyword whose word goes on into the next run\nbreaks with that run as one piece (`0x0762FC` to `0x076318`). A run that\nbreaks inside splits into two (`0x076448` to `0x0764C8`), with its trailing\nspaces trimmed (`VisibleLength`, `0x0764A4`). A run that would break at its\nfirst character moves whole to the next line (`0x076428` to `0x076438`)."
   },
   {
    "name": "TTextContext::NumLines",
    "entry": 484652,
    "text": "Returns the number of lines, the runs that start a line and are not empty\n(`0x076568` to `0x076580`), and 0 for a text with one empty run."
   },
   {
    "name": "TTextContext::Draw",
    "entry": 484816,
    "text": "Draws the text from a point, a line height apart, and returns the y one line\nbelow the last (`0x0766A8`). At each run that starts a line it adds the widths\nof the line's runs (`0x076628` to `0x076650`), justifies the line (`Justify`,\n`0x076660`) and moves down a line. It draws each run (`TStyleRun::Draw`,\n`0x076684`) in the text and highlight colors given."
   },
   {
    "name": "TTextContext::Justify",
    "entry": 485096,
    "text": "Returns a line's starting x for a justification, the x given for 0 (left), the\nx less half the line's width for 1 (centered, `0x076710` to `0x07671C`), and\nthe x less the whole width for -1 (right, `0x076724`). Any other value gives\nthe x unchanged (`0x0766FC`, `0x076704`)."
   },
   {
    "name": "TTextContext::DrawTextOutlined",
    "entry": 485212,
    "text": "Draws text with a shadow, in the shadow color one pixel down and to the right\n(`0x0767E4` to `0x076800`) and then in the text color at the point (`0x076840`\nto `0x07685C`), and then sets the text color back to black. A color from 0 up is a QuickDraw color\nconstant (`ForeColor`). One below 0 is an entry of the game's color table\n(`RGBForeColor`, entry -n of the table at toc -30216). When the text and the\nshadow are both black (33, or -255) the shadow becomes white, 30 (`0x076768`\nto `0x0767A4`)."
   },
   {
    "name": "TTextContext::~TTextContext",
    "entry": 485564,
    "text": "Frees every run (`0x0768E8` to `0x0768F8`), disposes of the characters' block (`DisposePtr`, `0x076908`) and frees the object when the flag is above 0."
   }
  ]
 },
 "TBufferGWorld": {
  "opening": "An offscreen drawing buffer that lives on the stack. Its constructor, which the\ncompiler builds inline at each place that makes the object, saves the current port and\ndevice at `+4` and `+8`, stores the offscreen `GWorld` at `+12` and sets it as\nthe port for drawing. The destructor copies the result to the saved port.",
  "routines": [
   {
    "name": "TBufferGWorld::~TBufferGWorld",
    "entry": 238272,
    "text": "Sets the saved port back (`SetGWorld`, `0x03A2E4`), reads the port's rectangle\nand widens it by the rectangle's left and top coordinates (`InsetRect` with\nboth negated, `0x03A318`), copies the offscreen picture into the port over that\nrectangle (`CopyBits`, `0x03A348`),\nand frees the object when the flag is above 0."
   }
  ]
 },
 "THood": {
  "opening": "The neighborhood, the list of things near the party that the game draws and\nupdates, from the current zone's list of things. The object has a byte at `+0`\nthat is 1 when the neighborhood is every thing in the zone, the center square\nat `+2` and `+4`, the count at `+6` and from `+8` the things' numbers, two bytes\neach, up to 2,048 (`THood::AddToHood`, `0x06C9E0`), or 16,384 with grimoire's\n`hood-size` fix.\n\nIn a zone of fewer than 1,536 things the neighborhood is all of them\n(`THood::ResetHood`, `0x06C7C4`), and a move never rebuilds it. In a larger\nzone it is the things within 32 squares of its center (`0x06C890` to\n`0x06C8DC`), and a move of more than 16 squares from the center rebuilds it\n(`THood::MoveHood`, `0x06C6A8` to `0x06C6F0`).",
  "routines": [
   {
    "name": "THood::THood",
    "entry": 443964,
    "text": "Makes an empty neighborhood centered off the map, at (-100, -100) (`0x06C63C` to `0x06C654`)."
   },
   {
    "name": "THood::MoveHood",
    "entry": 444032,
    "text": "Rebuilds the neighborhood around a square (`ResetHood`, `0x06C70C`) when the\nsquare is more than 16 from the center on either axis (`0x06C6A8` to\n`0x06C6F0`) and the neighborhood is not every thing in the zone."
   },
   {
    "name": "THood::ForceReset",
    "entry": 444248,
    "text": "Moves the center off the map and sets the byte at `+0` to 0, so that the next `MoveHood` rebuilds (`0x06C758` to `0x06C768`)."
   },
   {
    "name": "THood::ResetHood",
    "entry": 444312,
    "text": "Rebuilds the neighborhood around a square. It sets the byte at `+0` to 1 when\nthe zone has fewer than 1,536 things (`0x06C7C0` to `0x06C7DC`), and goes\nthrough the zone's things from 1, records of 16 bytes (`0x06C7FC`). It considers\na thing whose first byte, less 0x80, is 0 to 4, 0x20 to 0x24, 0x42 or 0x44\n(`0x06C804` to `0x06C848`). It always adds a count-down egg, first byte 0x42\nand kind 10 (`0x06C870` to `0x06C880`). In a large zone, for a thing more than\n32 squares from the center (`0x06C890` to `0x06C8DC`) it re-arms an egg whose\nfirst byte is 0xC2 to 0x42 (`0x06C8E4` to `0x06C8F0`), deletes a thing whose\nfirst byte has 0x20 (`DeleteProp`, `0x06C904`), and leaves the thing out. It\nthrows \"Too many objects in the neighborhood\" once the count reaches 2,048\n(`0x06C92C` to `0x06C948`)."
   },
   {
    "name": "THood::AddToHood",
    "entry": 444836,
    "text": "Adds a thing's number to the neighborhood (`0x06C9D8`), throws when the count\nreaches 2,048 (`0x06C9DC` to `0x06C9FC`), and at 1,536 or more sets the byte at\n`+0` to 0 so that the next move rebuilds (`ForceReset`, `0x06CA04` to\n`0x06CA28`)."
   },
   {
    "name": "THood::RemoveFromHood",
    "entry": 445032,
    "text": "Removes a thing's number, moving the last entry into its place (`0x06CA74` to `0x06CAC0`)."
   }
  ]
 },
 "TPathFinder": {
  "opening": "The search a character uses to find its way, one object at toc -30412. It works\nin a window of 31 by 31 squares centered on the view's center (the view object\nat toc -30408, x at `+8` and y at `+10`), with a byte for each square from\n`+0`. Before a search each byte is 8, for not reached\n(`TPathFinder::ResetPaths`, `0x05A254` to `0x05A260`). The start's byte is 255,\na step found blocked is -2, and any other value is the direction the search\nreached the square in. The open list has up to 100 squares of 12 bytes from\n`+964` (x, y, weight and the next square), with its head at `+2164`, its free\nlist at `+2168`, the closest square found at `+2172`, the number of squares in\nuse at `+2176`, the goal at `+2178` and `+2180`, the start at `+2182` and\n`+2184`, and the mover's attributes for `TGameSys::TryMove` at `+2188`.\n\nA direction is a number from 0 to 7, clockwise from north, with 0 north, 1\nnorth-east, 2 east, 3 south-east, 4 south, 5 south-west, 6 west and 7\nnorth-west. A step in a direction moves x by 1 for 1 to 3 and by -1 for 5 to 7,\nand y by -1 for 7, 0 and 1 and by 1 for 3 to 5 (`TPathFinder::CanSimpleNavigate`,\n`0x05A6A8` to `0x05A718`).",
  "routines": [
   {
    "name": "TPathFinder::ResetPaths",
    "entry": 369220,
    "text": "Sets every square of the window to 8, for not reached, and empties the open list (`0x05A254` to `0x05A284`)."
   },
   {
    "name": "TPathFinder::CalcWeight",
    "entry": 369356,
    "text": "Returns a square's Manhattan distance to the goal, the difference in x plus the difference in y (`0x05A2D8` to `0x05A2FC`)."
   },
   {
    "name": "TPathFinder::AddCandidate",
    "entry": 369468,
    "text": "Adds a square to the open list, kept in order of weight from the smallest\n(`0x05A3B4` to `0x05A41C`), ahead of any square of equal weight. The square comes\nfrom the free list (`0x05A358` to `0x05A368`) or else the next of the\n100 (`0x05A370` to `0x05A394`). Once all 100 are in use and none is free, the\nsquare is not added (`0x05A374`)."
   },
   {
    "name": "TPathFinder::AddNegCandidate",
    "entry": 369768,
    "text": "Adds a square to the open list in order of weight from the largest, for `FurthestPoint` (`0x05A4E0` to `0x05A548`)."
   },
   {
    "name": "TPathFinder::NextCandidate",
    "entry": 370068,
    "text": "Removes and returns the first square of the open list, or 0 (`0x05A598` to `0x05A5B8`)."
   },
   {
    "name": "TPathFinder::FreeCandidate",
    "entry": 370168,
    "text": "Puts a square on the free list (`0x05A5F8` to `0x05A600`)."
   },
   {
    "name": "TPathFinder::CanSimpleNavigate",
    "entry": 370264,
    "text": "Returns 1 when a straight walk from one square to another succeeds. It steps one\nsquare at a time in the direction from where it is to the goal\n(`FindDirection`, `0x05A69C`) and tries each step with `TGameSys::TryMove` and\nthe attributes given (`0x05A73C`), and returns 0 at the first step that\nfails."
   },
   {
    "name": "TPathFinder::FindWaypoint",
    "entry": 370632,
    "text": "Finds a path (`FindPath`, `0x05A80C`) and, when the search found one, the\nfurthest square along it that a straight walk reaches (`FindFirstWaypoint`,\n`0x05A838`), written back through the two pointers. It returns `FindPath`'s\nresult."
   },
   {
    "name": "TPathFinder::FindFirstStep",
    "entry": 370848,
    "text": "Writes back through the two pointers the first step from the start toward the\nclosest square found. It walks back from that square, by the direction in each\nsquare's byte, until it meets the start's 255 (`0x05A8F4` to `0x05A9B0`), and\nthe step it last walked back, turned round, is the answer (`0x05A9B4` to\n`0x05A9C0`). The loop never ends. It reads each byte sign-extended (`extsb`,\n`0x05A9A8`) and compares it with 255 (`0x05A9AC`), which a sign-extended byte\nnever equals, so at the start it walks on. The program's one call, in\n`TActiveMonster::DoMove`, is for behavior 17, which nothing in the shipped game\nsets. Grimoire's `walk-to` fix met the hang when played and compares with -1\ninstead. After `FindPath` returns 0 for a start that is the goal, `+2172` is\nstill 0 from `ResetPaths`, and the walk starts from address 0."
   },
   {
    "name": "TPathFinder::FindFirstWaypoint",
    "entry": 371200,
    "text": "Walks back from the closest square found toward the start and writes back\nthrough the two pointers the first square on the way that a straight walk from\nthe start reaches (`CanSimpleNavigate`, `0x05AA84`). The walk ends at the\nstart at the latest, since a straight walk from the start to itself succeeds.\nA test for a step back onto a square marked -2 calls `DebugStr` with \"Back step\ninto wall!\" (`0x05AB54` to `0x05AB60`). The test compares the sign-extended\nbyte with 254, which never matches, so the message never shows. Found reading,\nnot shown in a run."
   },
   {
    "name": "TPathFinder::FindPath",
    "entry": 371656,
    "text": "Looks for a way from a square to a goal for a mover. It returns 32767 at once\nwhen the start is more than 15 squares from the view's center on either axis\n(`0x05AC14` to `0x05AC58`), and 0 when the start is the goal (`0x05ACC4` to\n`0x05ACD4`). The attributes for the moves are the mover's with 0x08000000\nadded (`GetMonstAttrs`, `0x05ACE8`), or 0x88000004 with no mover\n(`0x05ACFC`). It is a best-first search by distance to the goal. It always\nexpands the open square nearest the goal and tries the eight steps from it\ninside the window (`0x05AD40` to `0x05AF08`). A step onto a square not\nreached that `TGameSys::TryMove` allows marks the square with its direction\nand opens it (`0x05AEB0` to `0x05AED8`). A blocked orthogonal step marks the\nsquare -2, and a blocked diagonal leaves it for another way (`0x05AEE0` to\n`0x05AEFC`). The search stops at the goal (`0x05AD10` to `0x05AD20`), when the\nopen list is empty, or at the first square that opens nothing once the search\nhas expanded a square 1 from the goal (`0x05AD24` to `0x05AD30`, `0x05AF0C` to\n`0x05AF20`), since the search sets its record of that square once and never\nclears it.\nThe closest square it reached is at `+2172`. It returns 32767 when the closest square is the start (`0x05AF84` to\n`0x05AFAC`), and otherwise that square's distance from the goal."
   },
   {
    "name": "TPathFinder::FurthestPoint",
    "entry": 372752,
    "text": "Looks for the reachable square furthest from a point, for a mover running away,\nwith the attributes given and 0x08000000 added (`0x05B0B8`). The search\nexpands the square furthest from the point first (`AddNegCandidate`), only\ntwo squares or more in from the window's edges (`0x05B1F8` to `0x05B288`), and\nstops at the first square at the edge of the area the view shows (`0x05B0D4`\nto `0x05B164`). It writes the furthest square it reached back through the two\npointers (`0x05B3B8` to `0x05B3CC`)."
   },
   {
    "name": "TPathFinder::FindDirection",
    "entry": 373788,
    "text": "Returns the direction of a step (dx, dy) from the ratio 1000 × dx / dy, with\nboundaries at ±410 and ±2,420 (`0x05B440` to `0x05B4D8`), about 22.5 and 67.5\ndegrees. A step with dy of 0 is east when dx is above 0 and west otherwise,\n(0, 0) among them (`0x05B41C` to `0x05B438`)."
   }
  ]
 },
 "THeap": {
  "opening": "The store of the game's persistent objects, the lists, strings and tables that\nscripts make, which a save includes. The program makes one heap at startup,\nwith 4,096 references and 262,144 bytes (`CreateGlobals`), and the global at toc\n-30284 points at it. The object has the heap's memory at `+0`, a table of chunk\naddresses by reference number at `+4`, the number of references at `+8` (a\nshort) and the heap's size in bytes at `+12` (`THeap::InitHeap`, `0x0AB358` to\n`0x0AB380`). Beside it the heap allocates a second block once, 8,192 bytes at\nthe address in the global at toc -30428 (`0x0AB3D0`), 4,096 halfwords with the\nreference number of each thing's table (`PropItem::AllocateFrame`). A save has\nthe heap as resource `0xF307` and the second block as `0xF308` (`THeap::Save`,\n`0x0AB850` and `0x0AB880`).\n\nThe heap is a run of chunks, each an 8-byte header and its data. The header\nhas the data's size at `+0`, the reference number at `+4` and, in the byte at\n`+6`, a bit 0x80, a type in bits 0x70 (0 for a free chunk), a bit 0x08 that\nmeans the chunk has 4 bytes more than its size rounded up to 4\n(`THeap::DataChunkSize`, `0x0AC06C` to `0x0AC088`), a bit 0x04, and with the\nbyte at `+7` a 10-bit count (`THeap::Free`, `0x0AB4C0` to `0x0AB508`). A chunk's\ndata is its size rounded up to 4, plus the 4 bytes when bit 0x08 is 1, and the\nnext chunk follows it (`THeap::Next`). Nothing collects garbage\n(`THeap::PerformGC` is empty). An object goes when its count of references\nfalls to 0 (`THeapObj::DecRef`).",
  "routines": [
   {
    "name": "THeap::InitHeap",
    "entry": 701228,
    "text": "Makes an empty heap of a number of references and a size. It allocates the\nmemory and a cleared table (`NewPtrClear`, `0x0AB364`, `0x0AB378`) and makes the\nwhole heap one free chunk (`0x0AB3BC`). It allocates the 8,192-byte block the\nfirst time (`0x0AB3D0`). No memory throws \"Can't allocate persistant storage\nheap\" [sic] or \"Can't allocate unique object storage map\"."
   },
   {
    "name": "THeap::GetHeader",
    "entry": 701520,
    "text": "Returns the chunk of a reference number, from the table (`0x0AB454`, `0x0AB458`)."
   },
   {
    "name": "THeap::Free",
    "entry": 701576,
    "text": "Frees a chunk. It clears the chunk's entry in the table (`0x0AB4B8`), makes it a\nfree chunk of its whole size with its reference and count at 0 (`0x0AB4C0` to\n`0x0AB508`), and joins each free chunk that follows to it (`0x0AB51C` to\n`0x0AB554`). It releases none of the objects in the chunk's data."
   },
   {
    "name": "THeap::Allocate",
    "entry": 701860,
    "text": "Allocates a chunk of a size for a reference number and a type\n(`THeap::Allocate` at `0x0ABCF4`, called at `0x0AB5D0`), and enters it in the\ntable under the number (`0x0AB5E8`)."
   },
   {
    "name": "THeap::Resize",
    "entry": 702036,
    "text": "Changes a chunk's size and returns the chunk, which can be a new one. A size\nno larger than the chunk's present space stays in place. When at least 8 bytes\nremain over, they become a free chunk after it (`0x0AB694` to `0x0AB710`).\nOtherwise it sets bit 0x08 when 4 to 7 bytes remain over (`0x0AB718` to\n`0x0AB730`). It leaves a bit 0x08 already at 1 as it is when 0 to 3 remain\nover, so the chunk's space then counts 4 bytes more than it has, and the heap\nlooks for the next chunk 4 bytes too far on (`0x0AB720`, `DataChunkSize`).\nFound reading, not shown in a run. A larger size allocates a new chunk\n(`0x0AB748`), points the table at it, copies the data, the reference and the\nflags (`0x0AB768` to `0x0AB7CC`) and frees the old one (`0x0AB7D4`). It reads\nthe old chunk's address before the allocation and uses it after, and the\nallocation can move every chunk in use (`Allocate` at `0x0ABCF4`). After a move\nthe copy and the free act on whatever chunk then sits at the old address. A\ngrow reaches this only when no free run fits but the free space in total does.\nFound reading, not shown in a run."
   },
   {
    "name": "THeap::Save",
    "entry": 702496,
    "text": "Writes the heap to an archive as resource `0xF307` and the 8,192-byte block as\n`0xF308` (`TSegFile::SaveSegment`, `0x0AB850`, `0x0AB880`), then the table of\ncontents when it has changed, and otherwise flushes the file."
   },
   {
    "name": "THeap::Load",
    "entry": 702716,
    "text": "Reads the heap from an archive, looking into the archive's table of contents\nfor page `0xF3` directly (`+980` of the `TSegFile`, `0x0AB914`). When resource\n`0xF307` is there, it reads a stored heap shorter than this one and makes the\nrest one free chunk (`0x0AB96C` to `0x0AB9F0`), reads one of the same size\nwhole (`0x0ABA14`), and throws \"Reducing Heap Size Not Implemented\" for a longer\none (`0x0ABA34`), so a save from a larger heap fails to load. Then it rebuilds\nthe table (`RebuildTOC`, `0x0ABA40`). When `0xF308` is there it reads it into\nthe 8,192-byte block (`0x0ABA88`), whatever its length."
   },
   {
    "name": "THeap::NewRef",
    "entry": 703184,
    "text": "Returns the first reference number from 1 up whose table entry is empty, and\nthrows \"Out of persistant storage objects\" [sic] when every one is in use\n(`0x0ABAF0` to `0x0ABB38`)."
   },
   {
    "name": "THeap::SimpleAllocate",
    "entry": 703360,
    "text": "Looks for a free run of chunks big enough for a size, first fit from the\nstart. It joins free chunks next to each other as it goes (`0x0ABBD8` to\n`0x0ABBF4`), cuts the first run big enough to the size (`Resize`, `0x0ABC30`)\nand returns it. It adds the space of each run too small to the total through\nits third argument (`0x0ABC38` to `0x0ABC60`) and returns 0 when none fits."
   },
   {
    "name": "THeap::PerformGC",
    "entry": 703688,
    "text": "Does nothing (4 bytes, a return)."
   },
   {
    "name": "THeap::Allocate",
    "entry": 703732,
    "text": "Allocates a chunk of a size, first from the free space as it is\n(`SimpleAllocate`, `0x0ABD28`). When nothing fits and the free space in total\nis too small, it calls `PerformGC`, which does nothing, tries again and throws\n\"Out of persistant storage space\" [sic] (`0x0ABD90`). When the free space is\nenough but in pieces, it moves every chunk in use down to the start of the\nheap, pointing the table at each (`0x0ABD98` to `0x0ABE2C`), and cuts the\nchunk from the free space left at the end (`0x0ABE70` to `0x0ABF14`). It\nthrows when even that is too small (`0x0ABE68`)."
   },
   {
    "name": "THeap::RebuildTOC",
    "entry": 704340,
    "text": "Rebuilds the table of chunks by reference number from the heap's chunks. At\nthe first chunk that is larger than the heap, has a type above 3, or has a\nreference number above the count, it stops and makes a free chunk of the rest\nof the heap (`0x0ABF80` to `0x0ABFD8`). It enters each chunk in use with a\nreference number in the table (`0x0ABFE0` to `0x0AC004`). A reference number\nequal to the count passes the test (`0x0ABFA8`), and the table entry for it\nlands one past the table's end."
   },
   {
    "name": "THeap::DataChunkSize",
    "entry": 704612,
    "text": "Returns a chunk's space for data, its size rounded up to 4 plus 4 when bit 0x08 is 1 (`0x0AC06C` to `0x0AC088`)."
   },
   {
    "name": "THeap::Next",
    "entry": 704712,
    "text": "Returns the chunk after one, at the header plus 8 plus the data's space, or 0 at the heap's end (`0x0AC0F4` to `0x0AC10C`)."
   },
   {
    "name": "THeap::RecoverHeader",
    "entry": 704868,
    "text": "Returns the chunk's header from the address of its data, 8 bytes before (`0x0AC16C`)."
   }
  ]
 },
 "THeapList": {
  "opening": "A list in the persistent heap, the data of a chunk of type 1. It has the length\nat `+0`, the room at `+2` (both shorts) and from `+4` the items, one value word\neach (`THeapList::THeapList`, `0x0A9DFC`, `0x0A9E18`).",
  "routines": [
   {
    "name": "THeapList::Allocate",
    "entry": 695516,
    "text": "Allocates a list of a length for a reference number, a chunk of type 1 (`THeap::Allocate`, `0x0A9D14`), and makes the list in it."
   },
   {
    "name": "THeapList::CalcSize",
    "entry": 695676,
    "text": "Returns the bytes a list of a length needs, 4 plus 4 for each item, with room for at least 4 (`0x0A9D80` to `0x0A9D98`)."
   },
   {
    "name": "THeapList::THeapList",
    "entry": 695756,
    "text": "Makes a list of a length, storing the length at `+0` (`0x0A9DFC`), with room for\nthe length and at least 4 (`0x0A9E18`), every item None (`0x0A9E3C` to\n`0x0A9E60`)."
   },
   {
    "name": "THeapList::~THeapList",
    "entry": 695984,
    "text": "Releases every item (`VAddr::DecRef`, `0x0A9EE8`) and frees the object when the flag is above 0."
   },
   {
    "name": "THeapList::Length",
    "entry": 696156,
    "text": "Returns the length."
   },
   {
    "name": "THeapList::GetItem",
    "entry": 696204,
    "text": "Returns the item at an index, or None for an index below 0 or not below the length (`0x0A9F8C` to `0x0A9FC4`)."
   },
   {
    "name": "THeapList::SetItem",
    "entry": 696308,
    "text": "Stores a value at an index from 0 below the length, counting a reference to it\nand releasing the old item (`0x0AA04C`, `0x0AA060`). An index outside does\nnothing, and so does the same value again."
   },
   {
    "name": "THeapList::Append",
    "entry": 696512,
    "text": "Adds a value at the end, counting a reference to it (`0x0AA140`). A full list\nfirst doubles its room and grows its chunk (`THeap::Resize`, `0x0AA0F4` to\n`0x0AA120`), which can move it, and then the value goes on the end of the list\nat its new place (`0x0AA134`)."
   }
  ]
 },
 "THeapDict": {
  "opening": "A table from numbers to values in the persistent heap, the data of a chunk of\ntype 2. It has the count at `+0`, the table's size at `+2` and from `+4` the\nentries, 8 bytes each, a key (a short) and a value. An empty entry has as its\nvalue `0x5000FFFE`, the word in the global at toc -29280 (`THeapDict::THeapDict`,\n`0x0AA3E0`), which the program's start-up code sets beside None (`0x5000FFFF`),\nTrue (`0x50000001`) and False (`0x50000000`) (`__sinit_THeap_cp`), so a table\ncan have None as a value. Nothing removes an entry. The sizes are primes from a\nlist at toc +11896, 3, 7, 13, 31, 61, 127, 251, 509, 1021, 2017, 4093, 5987,\n9551, 15683, 19609 and 31397 (`THeapDict::BestSize`, `0x0AA268`).",
  "routines": [
   {
    "name": "THeapDict::Allocate",
    "entry": 696744,
    "text": "Allocates a table for a number of entries and a reference number, a chunk of\ntype 2 (`THeap::Allocate`, `0x0AA1E8`), and makes the table in it at the size\n`BestSize` gives (`0x0AA1FC`)."
   },
   {
    "name": "THeapDict::BestSize",
    "entry": 696928,
    "text": "Returns the first size in the list above twice a number (`0x0AA280` to `0x0AA28C`), and throws \"HeapDict overflow\" past the last (`0x0AA2BC`)."
   },
   {
    "name": "THeapDict::CalcSize",
    "entry": 697096,
    "text": "Returns the bytes a table for a number of entries needs, 4 plus 8 for each entry of its size (`0x0AA31C` to `0x0AA330`)."
   },
   {
    "name": "THeapDict::THeapDict",
    "entry": 697196,
    "text": "Makes an empty table of a size, every entry with key 0 and the empty value (`0x0AA3C4` to `0x0AA3FC`)."
   },
   {
    "name": "THeapDict::~THeapDict",
    "entry": 697484,
    "text": "Releases every value that is not empty (`VAddr::DecRef`, `0x0AA4E8`) and frees the object when the flag is above 0."
   },
   {
    "name": "THeapDict::lookup",
    "entry": 697696,
    "text": "Returns the entry for a key, or 0 when there is none. It starts at the key\nmodulo the size and steps by a second number from the key, the key times 3\nplus 1, repeated until it is not a multiple of the size, modulo the size\n(`0x0AA584` to `0x0AA5A4`), until it finds the key or an empty entry\n(`0x0AA5A8` to `0x0AA604`)."
   },
   {
    "name": "THeapDict::insert",
    "entry": 697912,
    "text": "Stores a value under a key, searching as `lookup` does. It writes the key and\nthe value into an empty entry and adds 1 to the count (`0x0AA6B4` to\n`0x0AA6C8`). In an entry with the key it releases the old value and stores the\nnew one (`0x0AA6E4`). It counts no reference to the value."
   },
   {
    "name": "THeapDict::resize",
    "entry": 698204,
    "text": "Makes a larger table and returns it. It allocates the new table under the same\nreference number (`0x0AA788`, `0x0AA78C`) for `BestSize` of `BestSize` of the\ncount, so the new size is the first above twice the first above twice the\ncount. It inserts every entry into the new table (`0x0AA79C` to `0x0AA7E4`)\nand frees the old chunk (`0x0AA7FC`)."
   },
   {
    "name": "THeapDict::GetItem",
    "entry": 698436,
    "text": "Returns the value under a key, or None (`0x0AA86C` to `0x0AA88C`)."
   },
   {
    "name": "THeapDict::SetItem",
    "entry": 698576,
    "text": "Stores a value under a key, counting a reference to it (`0x0AA8F8`). When the\ncount times 3 is at least the size times 2, it first makes the table larger\n(`resize`, `0x0AA918`) and stores the value in the new one."
   }
  ]
 },
 "THeapObj": {
  "opening": "A reference to an object in the persistent heap, a 2-byte reference number,\nwhich a value word of type 7 has in its low half. The object's type is the\nchunk's type, 1 a list (`THeapList`), 2 a table (`THeapDict`), 3 a string, the\ncharacters and a zero byte. Its count of references is the chunk header's\n10-bit count (`THeap`).",
  "routines": [
   {
    "name": "THeapObj::IncRef",
    "entry": 698760,
    "text": "Adds 1 to the object's count (`0x0AA9C0` to `0x0AA9CC`). The count is 10 bits,\nso 1,023 references and one more give 0."
   },
   {
    "name": "THeapObj::DecRef",
    "entry": 698892,
    "text": "Subtracts 1 from the object's count (`0x0AAAA0` to `0x0AAAB4`), or, when the count is\n1 or 0, frees the object (`0x0AAA44`), first releasing a list's items or a\ntable's values (`0x0AAA74`, `0x0AAA84`) and then the chunk (`THeap::Free`,\n`0x0AAA94`)."
   },
   {
    "name": "THeapObj::GetType",
    "entry": 699124,
    "text": "Returns the object's type (`0x0AAB2C`)."
   },
   {
    "name": "THeapObj::At",
    "entry": 699228,
    "text": "Returns the item at an index of a list (`THeapList::GetItem`, `0x0AABD8`), the\nvalue under a key of a table (`THeapDict::GetItem`, `0x0AABEC`), or a string's\nbyte at an index below the chunk's size as a number, read signed\n(`0x0AABF4` to `0x0AAC18`). The index can be the string's zero byte. Any\nother gives None."
   },
   {
    "name": "THeapObj::AtPut",
    "entry": 699520,
    "text": "Stores a value at an index of a list (`THeapList::SetItem`, `0x0AACF4`) or under\na key of a table (`THeapDict::SetItem`, `0x0AAD08`), or a number's low byte at\nan index of a string below the chunk's size (`0x0AAD10` to `0x0AAD44`), which\ncan be the zero byte at its end."
   },
   {
    "name": "THeapObj::Append",
    "entry": 699788,
    "text": "Adds a value at the end of a list (`THeapList::Append`, `0x0AADD8`). It does nothing for any other type."
   },
   {
    "name": "THeapObj::Length",
    "entry": 699932,
    "text": "Returns a list's length (`0x0AAE7C`), a string's chunk size less 1\n(`0x0AAE84`), 32,767 for a table (`0x0AAE90`), and 0 for any other."
   },
   {
    "name": "THeapObj::THeapObj",
    "entry": 700120,
    "text": "Makes an object of a type, with a size or length and a reference number, a new\none (`THeap::NewRef`, `0x0AAF0C`) when the number given is 0. Their classes make\na list and a table (`0x0AAF48`, `0x0AAF58`). A string is a chunk of type 3 of\nthe size with a zero first byte (`0x0AAF70`, `0x0AAF7C`), and any other type an\nempty chunk (`0x0AAF94`). Its count starts at 0."
   },
   {
    "name": "THeapObj::GetString",
    "entry": 700392,
    "text": "Returns the address of the object's data, a string's characters (`0x0AB014`)."
   },
   {
    "name": "THeapObj::ResizeString",
    "entry": 700496,
    "text": "Changes a string's chunk to a size (`THeap::Resize`, `0x0AB0A4`). It does nothing for any other type."
   },
   {
    "name": "THeapObj::DispatchHeapObj",
    "entry": 700652,
    "text": "Runs a method of a script on an object, the `method` opcode's route for a value\nof type 7. Method 3 gives the length (`0x0AB158`), 4 the item at an index\n(`0x0AB184`), and 5 stores a value at an index and gives the object\n(`0x0AB1A4`). Method 7 adds the arguments to a list (`0x0AB1E0` to\n`0x0AB20C`), or adds their text to a string after growing the string's chunk to\nthe total (`0x0AB21C` to `0x0AB2C4`), and gives the object. A table, other\nmethods and other types give None (`0x0AB2D4`)."
   }
  ]
 },
 "VAddr": {
  "opening": "A value of the script machine, a 32-bit word. Its top 4 bits are its type, read\nsigned, so a word with the top bit set is type -1, a far address, a resource\nnumber in bits 16 to 30 and an offset in the low 16 (`VAddr::VAddr`,\n`0x0077F8` to `0x007808`). Type 0 is a number of 28 bits. Type 5 is None, True\nand False, `0x5000FFFF`, `0x50000001` and `0x50000000`. Type 4 is a game object,\nwith bit 24 at 1 for a system object (`VAddr::DecRef`, `0x0A9B98`). Type 7 is a\nheap object, its reference number in the low 16 bits.",
  "routines": [
   {
    "name": "VAddr::VAddr",
    "entry": 30700,
    "text": "Makes a value from a type and two halves, the type in the top 4 bits and the halves in the rest (`0x007810` to `0x007820`), or a far address for type -1 (`0x0077F8` to `0x007808`)."
   },
   {
    "name": "VAddr::VAddr",
    "entry": 541068,
    "text": "Makes the value 0."
   },
   {
    "name": "VAddr::DecRef",
    "entry": 695116,
    "text": "Releases a value. It deletes a system object (`DeleteSysObj`, `0x0A9BB0`) and\nlowers a heap object's count of references by 1 (`THeapObj::DecRef`,\n`0x0A9BFC`). Other values stay as they are."
   },
   {
    "name": "VAddr::IncRef",
    "entry": 695360,
    "text": "Counts a reference to a heap object (`THeapObj::IncRef`, `0x0A9C98`). It counts no other value, system objects among them."
   }
  ]
 },
 "PropItem": {
  "opening": "A thing in the game's world. The one routine here gives it a table in the\npersistent heap.",
  "routines": [
   {
    "name": "PropItem::AllocateFrame",
    "entry": 31836,
    "text": "Returns the thing's table, the heap object at `+12` when it is a table\n(`0x007C8C` to `0x007C9C`). Otherwise it makes a new table (`THeapObj::THeapObj`,\n`0x007CB4`), counts a reference to it, stores it at `+12` and, when the thing\nhas a number at `+8`, enters the table's reference number in the 8,192-byte\nblock of `THeap` at twice that number (`0x007CDC` to `0x007CF0`)."
   }
  ]
 },
 "TSegLoad": {
  "opening": "A copy of one resource of an archive in memory allocated for it, the address\nat `+0`.",
  "routines": [
   {
    "name": "TSegLoad::TSegLoad",
    "entry": 505940,
    "text": "Reads a resource of an archive whole into new memory (`NewPtr`, `0x07B8C8`,\n`TSegFile::LoadSegment`, `0x07B8EC`), its length from the archive's table\ndirectly (`0x07B888` to `0x07B8B0`). A missing resource or no memory leaves the\naddress 0."
   },
   {
    "name": "TSegLoad::~TSegLoad",
    "entry": 506168,
    "text": "Frees the memory (`DisposePtr`, `0x07B964`) and the object when the flag is above 0."
   },
   {
    "name": "TSegLoad::Loaded",
    "entry": 506304,
    "text": "Returns 1 when the read succeeded, the address not 0 (`0x07B9C0` to `0x07B9D0`)."
   },
   {
    "name": "TSegLoad::opPc",
    "entry": 506368,
    "text": "Returns the address of the copy."
   }
  ]
 },
 "TSpinCursor": {
  "opening": "The animated cursor that shows while the game is busy, from an 'acur' resource.\nThe game makes the object on the stack around the work. The counts of nesting\nand the cursor's frames are globals, so a second object made while one spins\ndoes nothing (`TSpinCursor::TSpinCursor`, `0x00F860`).",
  "routines": [
   {
    "name": "TSpinCursor::TSpinCursor",
    "entry": 63516,
    "text": "Starts the animated cursor of an 'acur' id. When the last cursor had the same\nid, it uses its frames again (`0x00F884` to `0x00F8A8`). Otherwise it releases\nthe old frames (`ResetCursor`, `0x00F8AC`) and reads the 'acur' (`GetResource`,\n`0x00F8C8`), up to 16 frames (`0x00F918` to `0x00F92C`), each a color cursor\n(`GetCCursor`, `0x00F964`), or a black-and-white one (`GetCursor`, `0x00F9C8`)\nwhen the first color one is missing (`0x00F974` to `0x00F998`). A later frame\nthat is missing stays empty. Then it shows the first frame (`Spin`,\n`0x00FA80`). With no 'acur' it shows the watch cursor (`GetCursor` of 4,\n`0x00FA90`)."
   },
   {
    "name": "TSpinCursor::Spin",
    "entry": 64228,
    "text": "Shows the next frame when 10 ticks or more have passed since the last\n(`TickCount`, `0x00FB28` to `0x00FB44`), as a color cursor or a black-and-white\none (`0x00FBCC`, `0x00FBE8`), and only while a flag of the application object\nat `+30` is 1 (`0x00FB14` to `0x00FB24`). It shows the frame it is at and then\nmoves to the next, wrapping at the number of frames (`0x00FB64` to\n`0x00FBA0`)."
   },
   {
    "name": "TSpinCursor::~TSpinCursor",
    "entry": 64568,
    "text": "Ends a nesting. When the last one ends, the frames stay in memory, marked for\nrelease if the next cursor is a different one (`0x00FC84` to `0x00FC8C`)."
   },
   {
    "name": "TSpinCursor::ResetCursor",
    "entry": 64744,
    "text": "Releases every frame and the 'acur' (`DisposeHandle`, `0x00FD58`, `0x00FD88`)."
   }
  ]
 },
 "TApWidget": {
  "opening": "The widget layer draws the windows built of controls, which in the shipped\nprogram is the Preferences window (`TApPrefWindow`). A widget is a pair of\nwords, a vtable and a control. With the Appearance Manager present the control\nis a Control Manager `ControlHandle`, and without it a `T7Widget` object.\nOne adapter at toc 16780 does the work for whichever kind is in use, and\n`TApWindow::AddAppearance` makes it on first use.",
  "routines": [
   {
    "name": "TApWidget::SetFont",
    "entry": 76,
    "text": "Sets a part's font. It reads the part's 24-byte `'font'` record\n(`ControlFontStyleRec`, through the widget's `GetData`, `0x000090`), with the flags\nfirst set to 255, then sets the flags to 0x47 and the font to the value given\n(`0x000098` to `0x0000AC`) and writes the record back (`SetData`,\n`0x0000C8`). The flags 0x47 mark the font, the face, the size and the\njustification as set. When `GetData` fails, as it does for every widget of the\nSystem 7 adapter, the record's other fields are whatever the stack held."
   },
   {
    "name": "TApWidget::SetData",
    "entry": 276,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 8), with the widget's control (`0x00015C`)."
   },
   {
    "name": "TApWidget::GetData",
    "entry": 420,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 12), with the widget's control (`0x0001F4`)."
   },
   {
    "name": "TApWidget::SetAlignment",
    "entry": 572,
    "text": "Sets a part's justification, as `SetFont` does, writing the value given at\n`+10` of the `'font'` record (`0x00029C`) with the flags 0x47."
   },
   {
    "name": "TApWidget::DisposeRoot",
    "entry": 18192,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 56), with the widget's control (`0x00473C`)."
   },
   {
    "name": "TApWidget::Activate",
    "entry": 18304,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 28), with the widget's control (`0x0047A8`)."
   },
   {
    "name": "TApWidget::Deactivate",
    "entry": 18412,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 32), with the widget's control (`0x004814`)."
   },
   {
    "name": "TApWidget::Enable",
    "entry": 18520,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 36), with the widget's control (`0x004880`)."
   },
   {
    "name": "TApWidget::Disable",
    "entry": 18624,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 40), with the widget's control (`0x0048E8`)."
   },
   {
    "name": "TApWidget::SetValue",
    "entry": 18728,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 16), with the widget's control (`0x004958`)."
   },
   {
    "name": "TApWidget::GetValue",
    "entry": 18844,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 20), with the widget's control (`0x0049C4`)."
   },
   {
    "name": "TApWidget::GetReference",
    "entry": 18952,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 24), with the widget's control (`0x004A30`)."
   },
   {
    "name": "TApWidget::Embed",
    "entry": 19064,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 44), with the widget's control (`0x004AB0`)."
   },
   {
    "name": "TApWidget::HandleWidgetClick",
    "entry": 19192,
    "text": "Passes the call to the adapter at toc 16780 (vtable offset 48), with the widget's control (`0x004B38`)."
   }
  ]
 },
 "TApWindow": {
  "opening": "A `TWindow` built of widgets. Its root widget's control is at `+16`.",
  "routines": [
   {
    "name": "TApWindow::AddAppearance",
    "entry": 15584,
    "text": "Makes the adapter on first use (`0x003CFC`). The adapter is a\n`TAppearanceAdapter` when byte 22 of the application object is 1 (`0x003D10`,\n`0x003D30` to `0x003D38`), which `TApp`'s start-up sets when `Gestalt('appr')`\nreports the Appearance Manager, and a `T7Adapter` otherwise (`0x003D58` to\n`0x003D60`). It then makes the window's root widget (`CreateRoot`, `0x003D7C`)\nand stores its control at `+16` (`0x003D88`)."
   },
   {
    "name": "TApWindow::HandleMessage",
    "entry": 15824,
    "text": "Passes a message below 0x20202020 to the application's `HandleCommand` (vtable\noffset 148, `0x003DE8` to `0x003E08`). A message of four characters, which is\n0x20202020 or more, goes no further here."
   },
   {
    "name": "TApWindow::SelfWidget",
    "entry": 15968,
    "text": "Returns the root widget, the widget vtable with the control at `+16` (`0x003E60` to `0x003E6C`)."
   },
   {
    "name": "TApWindow::~TApWindow",
    "entry": 16032,
    "text": "Disposes of the root widget (the adapter's `DisposeRoot`, `0x003EDC`), runs\n`TWindow::~TWindow` (`0x003EEC`) and frees the object when the flag is above 0."
   },
   {
    "name": "TApWindow::MouseRoutine",
    "entry": 16204,
    "text": "Finds the widget under the mouse (the adapter's `FindWidgetUnderMouse`,\n`0x003F90`) and, when there is one, tracks the click in it (`HandleWidgetClick`,\n`0x003FD4`, with -1 for the control's default action). When the click ends in\npart 11, a checkbox, it turns the value over, 1 for 0 and 0 for 1 (`0x003FF0`\nto `0x004038`). For a click that ends in any part it reads the control's\nreference number (`GetReference`, `0x004054`) and calls the window's\n`HandleMessage` with the widget, the reference number as the message and the\npart (vtable offset 132, `0x004078`)."
   },
   {
    "name": "TApWindow::DrawRoutine",
    "entry": 16592,
    "text": "Passes the call to the adapter's `DrawRoutine` with the window (`0x0040F4`)."
   },
   {
    "name": "TApWindow::ActivateRoutine",
    "entry": 16696,
    "text": "Passes the call to the adapter's `ActivateRoutine` with the window (`0x00415C`)."
   },
   {
    "name": "TApWindow::DeactivateRoutine",
    "entry": 16804,
    "text": "Passes the call to the adapter's `DeactivateRoutine` with the window (`0x0041C8`)."
   },
   {
    "name": "TApWindow::KeyRoutine",
    "entry": 16916,
    "text": "Passes the key to the adapter's `KeyRoutine` with the window (`0x004240`)."
   },
   {
    "name": "TApWindow::IdleRoutine",
    "entry": 17028,
    "text": "Passes the call to the adapter's `IdleRoutine` with the window (`0x0042A8`)."
   }
  ]
 },
 "TAppearanceAdapter": {
  "opening": "The adapter for the Appearance Manager. Each widget is a Control Manager\ncontrol, and each method makes the matching Control Manager call. A control's reference\nnumber is the message the window receives for a click in it.",
  "routines": [
   {
    "name": "TAppearanceAdapter::SetData",
    "entry": 776,
    "text": "Calls `SetControlData` with the control, the part, the tag, the size and the data (`0x00033C`)."
   },
   {
    "name": "TAppearanceAdapter::GetData",
    "entry": 908,
    "text": "Calls `GetControlData` with the control, the part, the tag, the size, the buffer and the size read (`0x0003C8`)."
   },
   {
    "name": "TAppearanceAdapter::SetValue",
    "entry": 1052,
    "text": "Calls `SetControlValue` (`0x000438`)."
   },
   {
    "name": "TAppearanceAdapter::GetValue",
    "entry": 1156,
    "text": "Returns `GetControlValue` (`0x000498`)."
   },
   {
    "name": "TAppearanceAdapter::GetReference",
    "entry": 1252,
    "text": "Returns `GetControlReference` (`0x0004F8`)."
   },
   {
    "name": "TAppearanceAdapter::Activate",
    "entry": 1352,
    "text": "Calls `ActivateControl` (`0x00055C`)."
   },
   {
    "name": "TAppearanceAdapter::Deactivate",
    "entry": 1448,
    "text": "Calls `DeactivateControl` (`0x0005BC`)."
   },
   {
    "name": "TAppearanceAdapter::Enable",
    "entry": 1548,
    "text": "Highlights the control with 0, active (`HiliteControl`, `0x00061C` to `0x000624`)."
   },
   {
    "name": "TAppearanceAdapter::Disable",
    "entry": 1648,
    "text": "Highlights the control with 255, inactive (`HiliteControl`, `0x000680` to `0x000688`)."
   },
   {
    "name": "TAppearanceAdapter::Embed",
    "entry": 1748,
    "text": "Embeds the control in the container given (`EmbedControl`, `0x0006F4`)."
   },
   {
    "name": "TAppearanceAdapter::HandleWidgetClick",
    "entry": 1864,
    "text": "Returns 0 for a control highlighted with 255 (byte 17 of its record,\n`0x000768` to `0x000778`), and otherwise the part `HandleControlClick` returns\n(`0x000790`)."
   },
   {
    "name": "TAppearanceAdapter::CreateRoot",
    "entry": 2052,
    "text": "Makes the window's root control (`CreateRootControl`, `0x00082C`) and returns it as a widget (`0x000838` to `0x000840`)."
   },
   {
    "name": "TAppearanceAdapter::DisposeRoot",
    "entry": 2204,
    "text": "Does nothing. The Window Manager disposes of the controls with the window."
   },
   {
    "name": "TAppearanceAdapter::NewTApControl",
    "entry": 2272,
    "text": "Embeds a new control in the parent widget given (the adapter's `Embed`,\n`0x000940`) and returns it as a widget (`0x000948`, `0x000950`)."
   },
   {
    "name": "TAppearanceAdapter::NewGroupBox",
    "entry": 2500,
    "text": "Makes a group box with a title, procID 160 (`NewControl`, `0x0009F8`,\n`0x000A1C`), and embeds it (`NewTApControl`, `0x000A38`)."
   },
   {
    "name": "TAppearanceAdapter::NewSlider",
    "entry": 2724,
    "text": "Makes a slider with the value, the minimum and the maximum given and procID 48\nplus the variant given (`0x000AD8`, `NewControl` at `0x000B00`), and embeds\nit."
   },
   {
    "name": "TAppearanceAdapter::NewCheckBox",
    "entry": 2952,
    "text": "Makes a checkbox, procID 1, with the value given and a range of 0 to 1 (`0x000BB8`, `0x000BBC`, `NewControl` at `0x000BE0`), and embeds it."
   },
   {
    "name": "TAppearanceAdapter::NewPushButton",
    "entry": 3176,
    "text": "Makes a push button, procID 0 (`0x000C9C`, `NewControl` at `0x000CC0`), and embeds it."
   },
   {
    "name": "TAppearanceAdapter::NewStaticIcon",
    "entry": 3400,
    "text": "Makes an icon control that does not track, procID 321, with the icon's resource number as its value\n(`0x000D78`, `0x000D88`, `NewControl` at `0x000DA0`), and embeds it."
   },
   {
    "name": "TAppearanceAdapter::NewStaticText",
    "entry": 3620,
    "text": "Makes a static text control, procID 288 (`0x000E30`, `NewControl` at\n`0x000E90`), embeds it, sets its font (`TApWidget::SetFont`, `0x000EC8`), and\nsets its `'text'` data to the Pascal string given (`0x000ED4` to `0x000EF8`)."
   },
   {
    "name": "TAppearanceAdapter::FindWidgetUnderMouse",
    "entry": 3972,
    "text": "Returns the control under a point as a widget (`FindControlUnderMouse`, `0x000FB8`), with its part written back."
   },
   {
    "name": "TAppearanceAdapter::DrawRoutine",
    "entry": 4156,
    "text": "Draws every control of the window (`DrawControls`, `0x001054`)."
   },
   {
    "name": "TAppearanceAdapter::ActivateRoutine",
    "entry": 4268,
    "text": "Activates the root control at `+16` (`ActivateControl`, `0x0010C4`)."
   },
   {
    "name": "TAppearanceAdapter::DeactivateRoutine",
    "entry": 4384,
    "text": "Deactivates the root control at `+16` (`DeactivateControl`, `0x001138`)."
   },
   {
    "name": "TAppearanceAdapter::KeyRoutine",
    "entry": 4504,
    "text": "Passes the current key to the control with the keyboard focus\n(`GetKeyboardFocus`, `0x0011BC`, then `HandleControlKey`, `0x0011F4`), with the\nkey code, the character and the modifiers of the event record at `+4` of the\napplication object (`0x0011CC` to `0x0011F0`)."
   },
   {
    "name": "TAppearanceAdapter::IdleRoutine",
    "entry": 4688,
    "text": "Gives the window's controls idle time (`IdleControls`, `0x001268`)."
   }
  ]
 },
 "T7Adapter": {
  "opening": "The adapter for System 7, with no Appearance Manager. Each widget's control is\na `T7Widget` object, and each call goes to that object's methods. Checkboxes\nand push buttons are still Control Manager controls inside a\n`T7ControlWidget`. The program draws the group box, the icon, the text and the\nslider.",
  "routines": [
   {
    "name": "T7Adapter::SetData",
    "entry": 11076,
    "text": "Calls the widget's `SetData` (`0x002B90`), and returns -30581, `errDataNotSupported`, for no widget (`0x002B6C`)."
   },
   {
    "name": "T7Adapter::GetData",
    "entry": 11280,
    "text": "Calls the widget's `GetData` (`0x002C64`), and returns -30581 for no widget (`0x002C3C`)."
   },
   {
    "name": "T7Adapter::SetValue",
    "entry": 11496,
    "text": "Calls the widget's `SetValue` (`0x002D14`) when there is one."
   },
   {
    "name": "T7Adapter::GetValue",
    "entry": 11656,
    "text": "Returns the widget's `GetValue` (`0x002DB4`), and 0 for no widget (`0x002DA0`)."
   },
   {
    "name": "T7Adapter::GetReference",
    "entry": 11820,
    "text": "Returns the reference number at `+4` of the widget (`0x002E3C`), and 0 for no widget."
   },
   {
    "name": "T7Adapter::Activate",
    "entry": 11892,
    "text": "Calls the widget's `Activate` (`0x002E98`) when there is one."
   },
   {
    "name": "T7Adapter::Deactivate",
    "entry": 12044,
    "text": "Calls the widget's `Deactivate` (`0x002F30`) when there is one."
   },
   {
    "name": "T7Adapter::Enable",
    "entry": 12200,
    "text": "Calls the widget's `Enable` (`0x002FCC`) when there is one."
   },
   {
    "name": "T7Adapter::Disable",
    "entry": 12348,
    "text": "Calls the widget's `Disable` (`0x003060`) when there is one."
   },
   {
    "name": "T7Adapter::Embed",
    "entry": 12496,
    "text": "Calls the widget's `Embed` with the parent given (`0x003104`) when there is one."
   },
   {
    "name": "T7Adapter::HandleWidgetClick",
    "entry": 12624,
    "text": "Returns the widget's `HandleWidgetClick` (`0x003194`), and 0 for no widget (`0x003174`)."
   },
   {
    "name": "T7Adapter::CreateRoot",
    "entry": 12800,
    "text": "Makes a `T7Widget` of 20 bytes with no children for the window's root (`0x00320C` to `0x00325C`) and returns it as a widget."
   },
   {
    "name": "T7Adapter::DisposeRoot",
    "entry": 12984,
    "text": "Deletes the root's `T7Widget` (its destructor with 1, `0x0032EC` to `0x0032F4`).\nThat destructor frees the root's list of children and nothing else, so every\nwidget below the root, with its color icon or slider, stays in memory after\nthe window closes. Found reading, not shown in a run."
   },
   {
    "name": "T7Adapter::NewT7Control",
    "entry": 13124,
    "text": "Wraps a Control Manager control in a new `T7ControlWidget` of 24 bytes\n(`0x00335C` to `0x003394`) and embeds it in the parent given (the adapter's\n`Embed`, `0x0033CC`)."
   },
   {
    "name": "T7Adapter::NewGroupBox",
    "entry": 13380,
    "text": "Makes a `T7GroupBox` of 284 bytes with the rectangle and the title given (`0x003460` to `0x0034A0`) and embeds it (`0x0034DC`)."
   },
   {
    "name": "T7Adapter::NewSlider",
    "entry": 13660,
    "text": "Makes a `T7SliderWidget` of 24 bytes from the arguments given (`0x003578` to `0x0035E0`) and embeds it (`0x00361C`)."
   },
   {
    "name": "T7Adapter::NewCheckBox",
    "entry": 13984,
    "text": "Makes a checkbox control, procID 1 with a range of 0 to 1 (`0x0036C4` to `0x0036DC`, `NewControl` at `0x0036F8`), and wraps it (`NewT7Control`, `0x003718`)."
   },
   {
    "name": "T7Adapter::NewPushButton",
    "entry": 14208,
    "text": "Makes a push button control, procID 0 (`0x0037B0`, `NewControl` at `0x0037D8`), and wraps it (`NewT7Control`, `0x0037F8`)."
   },
   {
    "name": "T7Adapter::NewStaticIcon",
    "entry": 14432,
    "text": "Makes a `T7IconWidget` of 32 bytes with the rectangle and the icon number given (`0x00387C` to `0x0038BC`) and embeds it (`0x0038F8`)."
   },
   {
    "name": "T7Adapter::NewStaticText",
    "entry": 14712,
    "text": "Makes a `T7LabelWidget` of 288 bytes with the rectangle and the text given\n(`0x003994` to `0x0039D4`), sets its font (`TApWidget::SetFont`, `0x0039FC`)\nand embeds it (`0x003A20`)."
   },
   {
    "name": "T7Adapter::FindWidgetUnderMouse",
    "entry": 15012,
    "text": "Returns the root widget's `FindWidgetUnderMouse` for a point (`0x003AE8`), and no widget for a window with no root (`0x003AF8` to `0x003B04`)."
   },
   {
    "name": "T7Adapter::DrawRoutine",
    "entry": 15208,
    "text": "Draws the root widget and so every widget below it (`0x003B94`)."
   },
   {
    "name": "T7Adapter::ActivateRoutine",
    "entry": 15336,
    "text": "Does nothing."
   },
   {
    "name": "T7Adapter::DeactivateRoutine",
    "entry": 15400,
    "text": "Does nothing."
   },
   {
    "name": "T7Adapter::KeyRoutine",
    "entry": 15464,
    "text": "Does nothing, so under System 7 a key reaches no control."
   },
   {
    "name": "T7Adapter::IdleRoutine",
    "entry": 15524,
    "text": "Does nothing."
   }
  ]
 },
 "T7Widget": {
  "opening": "A widget of the System 7 adapter, and the root of each window's widgets. It has\nits reference number at `+4` and a list of children from `+8`, a growable array\nwith its capacity at `+8`, its count at `+12` and its entries at `+16`. A\nmethod that a kind of widget does not need does nothing here.",
  "routines": [
   {
    "name": "T7Widget::Embed",
    "entry": 4800,
    "text": "Adds the widget to the parent's children (`0x0013AC`). A full array grows to\ntwice its capacity, or to 1 from empty (`0x0013B4` to `0x0013CC`), with its\nentries copied across and the old array freed (`0x001444` to `0x001480`). It\nthrows `length_error` (\"vector::insert length error\") past 0x3FFFFFFF entries\n(`0x001330` to `0x001374`) and `bad_alloc` when the allocation fails\n(`0x0013E4` to `0x00140C`)."
   },
   {
    "name": "T7Widget::DrawRoutine",
    "entry": 6068,
    "text": "Draws each child in order (`0x0017D4` to `0x001800`)."
   },
   {
    "name": "T7Widget::FindWidgetUnderMouse",
    "entry": 6216,
    "text": "Calls each child's `FindWidgetUnderMouse` in order and returns the first widget found (`0x001874` to `0x0018B8`), or no widget."
   },
   {
    "name": "T7Widget::HandleWidgetClick",
    "entry": 6452,
    "text": "Returns 0."
   },
   {
    "name": "T7Widget::~T7Widget",
    "entry": 6732,
    "text": "Frees the list of children (`0x001A98` to `0x001A9C`), not the children, and frees the object when the flag is above 0."
   },
   {
    "name": "T7Widget::SetData",
    "entry": 11228,
    "text": "Returns -30581, `errDataNotSupported`."
   },
   {
    "name": "T7Widget::GetData",
    "entry": 11440,
    "text": "Returns -30581, `errDataNotSupported`."
   },
   {
    "name": "T7Widget::SetValue",
    "entry": 11612,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::GetValue",
    "entry": 11772,
    "text": "Returns 0."
   },
   {
    "name": "T7Widget::Activate",
    "entry": 12000,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::Deactivate",
    "entry": 12152,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::Enable",
    "entry": 12304,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::Disable",
    "entry": 12452,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::ActivateRoutine",
    "entry": 17132,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::DeactivateRoutine",
    "entry": 17184,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::KeyRoutine",
    "entry": 17240,
    "text": "Does nothing."
   },
   {
    "name": "T7Widget::IdleRoutine",
    "entry": 17288,
    "text": "Does nothing."
   }
  ]
 },
 "T7ControlWidget": {
  "opening": "A Control Manager control as a widget of the System 7 adapter, 24 bytes, with\nthe `ControlHandle` at `+20`.",
  "routines": [
   {
    "name": "T7ControlWidget::T7ControlWidget",
    "entry": 6536,
    "text": "Stores the reference number at `+4` and the control at `+20` (`0x0019CC`, `0x0019F4`), with no children."
   },
   {
    "name": "T7ControlWidget::SetValue",
    "entry": 6928,
    "text": "Calls `SetControlValue` (`0x001B30`)."
   },
   {
    "name": "T7ControlWidget::GetValue",
    "entry": 7032,
    "text": "Returns `GetControlValue` (`0x001B90`)."
   },
   {
    "name": "T7ControlWidget::Activate",
    "entry": 7128,
    "text": "Highlights the control with 0 (`HiliteControl`, `0x001BF4`)."
   },
   {
    "name": "T7ControlWidget::Deactivate",
    "entry": 7228,
    "text": "Highlights the control with 255 (`HiliteControl`, `0x001C58`)."
   },
   {
    "name": "T7ControlWidget::Enable",
    "entry": 7332,
    "text": "Highlights the control with 0 (`HiliteControl`, `0x001CC0`)."
   },
   {
    "name": "T7ControlWidget::Disable",
    "entry": 7432,
    "text": "Highlights the control with 255 (`HiliteControl`, `0x001D24`)."
   },
   {
    "name": "T7ControlWidget::DrawRoutine",
    "entry": 7532,
    "text": "Draws the control (`Draw1Control`, `0x001D84`)."
   },
   {
    "name": "T7ControlWidget::FindWidgetUnderMouse",
    "entry": 7632,
    "text": "Returns this widget when the point is inside the control's rectangle\n(`PtInRect`, `0x001E0C`) and `FindControl` finds this control there\n(`0x001E30` to `0x001E4C`), with the part written back (`0x001E3C`)."
   },
   {
    "name": "T7ControlWidget::HandleWidgetClick",
    "entry": 7880,
    "text": "Tracks the click (`TrackControl`, `0x001EF0`) and returns the part."
   },
   {
    "name": "T7ControlWidget::~T7ControlWidget",
    "entry": 17764,
    "text": "Frees the list of children and frees the object when the flag is above 0. The control stays for the Window Manager."
   }
  ]
 },
 "T7GroupBox": {
  "opening": "A group box drawn by the program under System 7, 284 bytes, with its rectangle\nat `+20` and its title, a Pascal string, at `+28`.",
  "routines": [
   {
    "name": "T7GroupBox::T7GroupBox",
    "entry": 8028,
    "text": "Stores the reference number, the rectangle and the title (`0x001FD4` to `0x001FE0`)."
   },
   {
    "name": "T7GroupBox::DrawRoutine",
    "entry": 8244,
    "text": "Frames the rectangle with its top 16 lower (`FrameRect`, `0x002074` to\n`0x002080`), draws the title in the system font at that line, 4 in from the\nleft, over the frame (`TextMode` 0, `MoveTo`, `DrawString`, `0x002088` to\n`0x0020B0`), and draws the children (`T7Widget::DrawRoutine`, `0x0020C8`)."
   },
   {
    "name": "T7GroupBox::~T7GroupBox",
    "entry": 17552,
    "text": "Frees the list of children and frees the object when the flag is above 0."
   }
  ]
 },
 "T7IconWidget": {
  "opening": "A color icon drawn by the program under System 7, 32 bytes, with its rectangle\nat `+20` and the `CIconHandle` at `+28`.",
  "routines": [
   {
    "name": "T7IconWidget::T7IconWidget",
    "entry": 8464,
    "text": "Stores the reference number and the rectangle, and loads the `cicn` of the number given (`GetCIcon`, `0x002190`)."
   },
   {
    "name": "T7IconWidget::~T7IconWidget",
    "entry": 8680,
    "text": "Disposes of the icon (`DisposeCIcon`, `0x00221C`), frees the list of children and frees the object when the flag is above 0."
   },
   {
    "name": "T7IconWidget::DrawRoutine",
    "entry": 8908,
    "text": "Draws the icon in its rectangle (`PlotCIcon`, `0x0022E8`)."
   }
  ]
 },
 "T7LabelWidget": {
  "opening": "Static text drawn by the program under System 7, 288 bytes, with its rectangle\nat `+20`, the text, a Pascal string, at `+28`, the justification at `+284` and\nthe font at `+286`.",
  "routines": [
   {
    "name": "T7LabelWidget::T7LabelWidget",
    "entry": 9012,
    "text": "Stores the reference number, the rectangle and the text (`PLstrcpy`, `0x0023B8`), with a justification of 0 and a font of -1 (`0x0023C0` to `0x0023D0`)."
   },
   {
    "name": "T7LabelWidget::SetData",
    "entry": 9248,
    "text": "Accepts only `'font'` data (`0x002420`, `0x002428`), and returns -30581 for any\nother (`0x002464`). From the record it copies the font when the flags have 0x01\n(`0x002438` to `0x002444`) and the justification when they have 0x40\n(`0x00244C` to `0x002458`)."
   },
   {
    "name": "T7LabelWidget::DrawRoutine",
    "entry": 9380,
    "text": "Draws the text in its rectangle with `TETextBox` and the justification\n(`0x00256C`). A font of -1 draws in the system font, -2 in Geneva 10 and -3 in\nGeneva 10 bold (`0x0024DC` to `0x002554`). Any other value draws in the\napplication font, set before the test (`0x0024B4` to `0x0024D4`). After\n`TETextBox` it sets the application font, size 0 and plain text again."
   },
   {
    "name": "T7LabelWidget::~T7LabelWidget",
    "entry": 17336,
    "text": "Frees the list of children and frees the object when the flag is above 0."
   }
  ]
 },
 "T7SliderWidget": {
  "opening": "A slider drawn by the program's slider routines under System 7, 24 bytes,\nwith the slider at `+20` (`CreateSlider`).",
  "routines": [
   {
    "name": "T7SliderWidget::T7SliderWidget",
    "entry": 9696,
    "text": "Stores the reference number and makes the slider from the other arguments (`CreateSlider`, `0x00268C`)."
   },
   {
    "name": "T7SliderWidget::~T7SliderWidget",
    "entry": 9980,
    "text": "Disposes of the slider (`DisposeSlider`, `0x002730`), frees the list of children and frees the object when the flag is above 0."
   },
   {
    "name": "T7SliderWidget::SetValue",
    "entry": 10208,
    "text": "Sets the slider's value (`SetSliderValue`, `0x002800`)."
   },
   {
    "name": "T7SliderWidget::GetValue",
    "entry": 10312,
    "text": "Returns the slider's value (`GetSliderValue`, `0x002860`)."
   },
   {
    "name": "T7SliderWidget::Activate",
    "entry": 10408,
    "text": "Enables the slider (`SetSliderEnabled` with 1, `0x0028AC` to `0x0028C4`)."
   },
   {
    "name": "T7SliderWidget::Deactivate",
    "entry": 10508,
    "text": "Disables the slider (`SetSliderEnabled` with 0, `0x002910` to `0x002928`)."
   },
   {
    "name": "T7SliderWidget::DrawRoutine",
    "entry": 10612,
    "text": "Draws the slider (`DrawSlider`, `0x00298C`)."
   },
   {
    "name": "T7SliderWidget::FindWidgetUnderMouse",
    "entry": 10712,
    "text": "Returns this widget, with part 129, when the point is inside the slider's rectangle (`PtInRect`, `0x002A10`, `0x002A24`)."
   },
   {
    "name": "T7SliderWidget::HandleWidgetClick",
    "entry": 10916,
    "text": "Tracks the drag (`TrackSlider`, `0x002AC4`) and returns 129 when the value changed, and 0 otherwise."
   }
  ]
 },
 "TApPrefWindow": {
  "opening": "The Preferences window, a `TApWindow`. It has three groups, Sound, Game Control\nand Miscellaneous, and the buttons Save, Cancel and, when InputSprocket is\npresent, Set Controls.... The widgets are at fixed places in the object.\n\n| at | widget | message |\n|---|---|---|\n| `+20` | Sound Volume slider, 1 to 8 | `svol` |\n| `+28` | Mute checkbox for sound | `smut` |\n| `+36` | System Volume checkbox | `ssys` |\n| `+44` | Music Volume slider | `mvol` |\n| `+52` | Mute checkbox for music | `mmut` |\n| `+60` | Graphics Quality slider, 0 to 2 | none |\n| `+68` | Ambient Sounds checkbox | `ambs` |\n| `+76` | Live Dragging checkbox | none |\n| `+84` | Manually Place Containers checkbox | none |\n| `+92` | Use 'ZoomRects' checkbox | none |\n| `+100` | Walk around obstacles checkbox | none |\n| `+108` | Motion Filters checkbox | none |\n\nThe sound settings are 6 bytes at `+116` as the window opened and at `+122` as\nthey are now. The ambient switch is at `+0`, the music volume at `+2` and the\nsound volume at `+4`, where 0 means muted and -1 the system volume. The other\nsettings are the 4 bytes of the \"UI Prefs\" record at toc -5216.",
  "routines": [
   {
    "name": "TApPrefWindow::GetCurSettings",
    "entry": 663796,
    "text": "Reads the saved sound settings (`TPrefs::GetOrdinal`), \"Volume\" with 5 if there\nis none, \"Music\" with 8 and \"Ambient\" with 1 (`0x0A210C` to `0x0A2168`)."
   },
   {
    "name": "TApPrefWindow::AdjustSettings",
    "entry": 664032,
    "text": "Reads the sound settings from the widgets. The sound volume is the slider's\nvalue, 0 for a checked Mute and -1 for a checked System Volume (`0x0A2204` to\n`0x0A225C`). The music volume is its slider's value, or 0 for a checked music\nMute (`0x0A2260` to `0x0A2298`), and the ambient switch is the\ncheckbox (`0x0A22B0`)."
   },
   {
    "name": "TApPrefWindow::ApplySettings",
    "entry": 664356,
    "text": "Sets the game's sound volume, music volume and ambient sounds from a record\n(`TAudio::SetSoundVolume`, `SetMusicVolume`, `EnableAmbient`, `0x0A234C` to\n`0x0A2374`), each with 1 as the last argument, so that each one also writes\nits preference."
   },
   {
    "name": "TApPrefWindow::SaveSettings",
    "entry": 664552,
    "text": "Applies the current sound settings (`0x0A2410`) and writes the checkboxes into\nthe \"UI Prefs\" record. Walk around obstacles is 0x40 of its second byte\n(`0x0A242C`), Live Dragging 0x01 of its first (`0x0A244C`), Motion Filters\n0x08 of the second (`0x0A249C`), Use 'ZoomRects' 0x80 of the second\n(`0x0A24BC`) and Manually Place Containers 0x40 of the first (`0x0A24DC`). Live\nDragging is also copied to bytes 103, 104 and 105 of the application object\n(`0x0A2458` to `0x0A2484`). Graphics Quality 0 clears 0x80 and 0x02 of the\nfirst byte, 1 sets 0x80 alone and 2 sets both (`0x0A24F8` to `0x0A2584`). It\nthen saves the 4 bytes as \"UI Prefs\" (`TPrefs::SavePrefs`, `0x0A259C`)."
   },
   {
    "name": "TApPrefWindow::AddContent",
    "entry": 665076,
    "text": "Builds the window. Under the Appearance Manager it gives it the theme's\nbackground (`SetThemeWindowBackground`, `0x0A2648`). It reads the saved sound\nsettings into `+116` and copies them to `+122` (`0x0A265C` to `0x0A267C`),\nand makes the three groups with their widgets through the adapter in the\norder of the table above. The sound slider starts at the saved volume, or 5\nwhen it is not above 0 (`0x0A273C` to `0x0A2750`), with the icons 128 and 129\nbeside it (`0x0A27C0`, `0x0A2864`). Graphics Quality starts from bits 0x80 and\n0x02 of the \"UI Prefs\" record's first byte (`0x0A2E08` to `0x0A2E30`), with\nthe labels Better Performance and Better Quality. Set\nControls... appears only when `HasISSupport` returns true (`0x0A349C` to\n`0x0A34A8`)."
   },
   {
    "name": "TApPrefWindow::KeyRoutine",
    "entry": 669048,
    "text": "Turns Escape into Cancel (`canc`, `0x0A359C`, `0x0A3608` to `0x0A3634`),\nReturn and Enter into Save (`save`, `0x0A35AC` to `0x0A35FC`), and \"i\" into\nSet Controls... when InputSprocket is present (`iscf`, `0x0A35C4`, `0x0A3640`\nto `0x0A367C`). It passes every other key to the adapter (`0x0A3688` to\n`0x0A36A0`)."
   },
   {
    "name": "TApPrefWindow::HandleMessage",
    "entry": 669428,
    "text": "Acts on a widget's message. After each change to sound it reads and applies\nthe settings at once (`AdjustSettings`, `ApplySettings`), and most also play\ninterface sound 5 (`TAudio::PlayIFSound`).\n\n- `svol` unchecks and enables both Mute and System Volume (`0x0A3810` to\n  `0x0A3860`).\n- `smut` disables System Volume while Mute's value is 1 and enables it\n  otherwise (`0x0A3894` to `0x0A38D4`). `ssys` does the same to Mute\n  (`0x0A3908` to `0x0A3948`).\n- `mvol` unchecks the music's Mute (`0x0A397C` to `0x0A398C`), and `mvol`\n  and `mmut` play no sound.\n- `save` sets byte 29 of the application object to 1 and saves\n  (`SaveSettings`, `0x0A39CC` to `0x0A39E0`).\n- `canc` applies the settings the window opened with (`0x0A39E8` to\n  `0x0A39F0`) and sets byte 29 to 1.\n- `iscf` opens InputSprocket's configuration (`ConfigureIS`, `0x0A3A08`).\n- A message of 0, the reference number of every widget without a message in\n  the table, plays the sound and then goes to `TApWindow::HandleMessage`, as\n  every message not listed does (`0x0A3A14` to `0x0A3A38`)."
   },
   {
    "name": "TApPrefWindow::~TApPrefWindow",
    "entry": 671004,
    "text": "Runs `TApWindow::~TApWindow` (`0x0A3D48`) and frees the object when the flag is above 0."
   }
  ]
 },
 "TAppearanceMenu": {
  "opening": "A `TCommandMenu` with an Appearance Manager command number on each item.",
  "routines": [
   {
    "name": "TAppearanceMenu::TAppearanceMenu",
    "entry": 62728,
    "text": "Loads the menu of the number given (`GetMenu`, `0x00F538`) and, when it exists, inserts it before the menu given (`InsertMenu`, `0x00F558`)."
   },
   {
    "name": "TAppearanceMenu::GetCommand",
    "entry": 62892,
    "text": "Returns an item's command number (`GetMenuItemCommandID`, `0x00F5D0`), and 0 when the call fails (`0x00F5E8`)."
   }
  ]
 },
 "TStream": {
  "opening": "The base of the game's streams, which save and restore the game's records in a\nformat of letters. The object has its vtable at `+0` and a chunk's place at\n`+4`, the position of its length word while a chunk goes out and its end while one comes in. The vtable's slots are 8 GetPos, 12 SetPos, 16 GetSize, 20 `IsEOF`,\n24 Write, 28 Read, 32 ReadTo, 36 `Align`, 40 `WriteData`, 44 `ReadData`, 48\n`BeginChunk`, 52 `EndChunk`, 56 `ReadChunk` and 60 `IsEOChunk`. Slots 8 to 16\nand 24 to 32 are 0 in `TStream`'s vtable and filled in `TMemoryStream`'s, and\nthe other slots have `TStream`'s routines in both, but for `TMemoryStream`'s\n`Align`.\n\nA format is a string of letters, one for each value, read from the left.\n\n| letter | value |\n|---|---|\n| `b` | 1 byte |\n| `h` | 2 bytes |\n| `i`, `l` | 4 bytes |\n| `s` | a C string, its 0 byte included |\n| `P` | a Pascal string, its length byte and that many bytes |\n| `H` | a handle, as a 4-byte size and that many bytes, a size of -1 for no handle |\n| `a` | a block, given as a size and then an address |\n| a space | aligns the position to 2 bytes |\n| `;` | aligns the position to 4 bytes | The routines skip any other character. The letters are the cases of the two routines'\ncomparisons (`0x0179E4` to `0x017A58`, `0x017D50` to `0x017DC4`). The formats\nin the program's strings use `b`, `h`, `l`, `P` and `a`, such as `\"hhhh\"` and `\"Phhh\"`.",
  "routines": [
   {
    "name": "TStream::ReadData",
    "entry": 96656,
    "text": "Reads the values of a format into the addresses that follow it, one address\nfor each letter (`a` has a size and then an address), through the stream's\nRead (slot 28) and `Align` (slot 36). It stops at the format's end or at the\nfirst read that returns other than 0, and returns that result (`0x017CA0` to\n`0x017CC0`). The routine reads a C string one byte at a time until its 0 byte, with no\nbound on its length (`0x017A90` to `0x017AC4`), each byte stored before the test of the read's result (`0x017AAC` to `0x017AC4`), so a failed read stores the\nbyte last held at `60(1)`, never set on the first pass. A Pascal string reads its\nlength byte and then that many bytes, none for a length of 0 (`0x017B74` to\n`0x017BC4`). A handle with a size of -1, or one whose size the read failed on, comes back as 0 (`0x017C04` to `0x017C14`). Otherwise the routine allocates a handle of\nthat size, locks it, reads into it and unlocks it (`0x017C1C` to `0x017C60`),\nwith no test for an allocation that failed, so the read would go through the word at address 0 for a handle of 0."
   },
   {
    "name": "TStream::WriteData",
    "entry": 97532,
    "text": "Writes the values that follow a format, one argument for each letter (`a` has a\nsize and then an address), through the stream's Write (slot 24) and `Align`\n(slot 36). The argument for `b`, `h`, `i` and `l` is the value itself, and for\n`s`, `P` and `H` an address or a handle. It stops at the format's end or at the first write\nthat returns other than 0, and returns that result (`0x018020` to `0x018040`).\nThe routine writes a C string with its 0 byte, by its length from `strlen` plus 1\n(`0x017DF0` to `0x017E1C`). The routine writes a handle of 0 as the size -1 (`0x017F2C`\nto `0x017F50`). The routine writes any other handle as its size and its bytes, locked during the write and then set back to the state it had (`0x017F60` to\n`0x017FE0`)."
   },
   {
    "name": "TStream::Align",
    "entry": 98428,
    "text": "Does nothing and returns 0 (`0x01807C`)."
   },
   {
    "name": "TStream::IsEOF",
    "entry": 98472,
    "text": "Returns 1 when the position (slot 8) has reached the size (slot 16), and 0\nbefore it, in a signed comparison (`0x0180C0` to `0x018104`)."
   },
   {
    "name": "TStream::BeginChunk",
    "entry": 98612,
    "text": "Opens a chunk with the 4-byte tag given (`0x018144` to `0x01815C`). It records\nthe position after the tag at `+4` (`0x018164` to `0x018178`) and writes a 4-byte 0 there for `EndChunk` to replace with the chunk's length (`0x01817C` to `0x018198`). It\nreturns the second write's result, and the tag write's result goes missing, the position at `0x018170` taking r3. One chunk can be open at a time, because a\nsecond `BeginChunk` before the first one's `EndChunk` replaces `+4`."
   },
   {
    "name": "TStream::EndChunk",
    "entry": 98784,
    "text": "Closes the chunk that `BeginChunk` opened. It writes the chunk's length, from\nthe length word to the present position and so counting the length word's 4\nbytes, at the place recorded at `+4` (`0x0181F8` to `0x018244`). It then sets\nthe position back to the end (`0x01824C` to `0x01825C`), and returns what that\nSetPos leaves in r3. On a memory stream, whose SetPos (`TMemoryStream::SetPos`) sets no result, the routine returns the stream's address."
   },
   {
    "name": "TStream::ReadChunk",
    "entry": 98980,
    "text": "Reads a 4-byte tag and compares it with the tag given (`0x0182B4` to\n`0x0182E0`). On a different tag it sets `+4` to -1 and returns -43, with the\ntag already read (`0x0182E4` to `0x0182EC`). On the same tag it reads the\nchunk's length and sets `+4` to the chunk's end, the length word's position\nplus the length (`0x0182F4` to `0x018338`), and returns 0. No test follows either read (`0x0182CC`, `0x018308`), so a failed tag read compares the\ntag with the local at `56(1)`, never set, and a failed length read adds the\nposition to whatever `+4` held."
   },
   {
    "name": "TStream::IsEOChunk",
    "entry": 99196,
    "text": "Returns 1 when the position (slot 8) has reached the chunk's end at `+4`, and 0\nbefore it, in a signed comparison (`0x018390` to `0x0183C0`). After a\n`ReadChunk` that found a different tag the end is -1, so the routine returns\n1."
   }
  ]
 },
 "TMemoryStream": {
  "opening": "A stream over a block of memory, the stream that `TDelverApp::SaveToFile` and\n`TDelverApp::RestoreModel` use. The object has its vtable at `+0`, `TStream`'s\nchunk place at `+4`, the block's start at `+8`, the position at `+12`, as an\naddress, and the block's end at `+16`. None of its routines compares the\nposition with the end, so a read or a write past the end goes on into the\nmemory after the block.",
  "routines": [
   {
    "name": "TMemoryStream::TMemoryStream",
    "entry": 99312,
    "text": "Sets the vtable, the block's start and end from the address and size given, and\nthe position to the start (`0x0183F0` to `0x018410`). It leaves `+4` as the\nmemory had it."
   },
   {
    "name": "TMemoryStream::Align",
    "entry": 99400,
    "text": "Rounds the position up to a multiple of the number given, which has to be a\npower of 2, and returns 0 (`0x018448` to `0x01846C`). The position is an\naddress, so the rounding is to the address in memory, not to the offset from\nthe block's start."
   },
   {
    "name": "TMemoryStream::GetPos",
    "entry": 99488,
    "text": "Returns the position as an offset from the block's start (`0x0184A0` to `0x0184A8`)."
   },
   {
    "name": "TMemoryStream::GetSize",
    "entry": 99548,
    "text": "Returns the block's size, its end less its start (`0x0184DC` to `0x0184E4`), not the number of bytes written."
   },
   {
    "name": "TMemoryStream::SetPos",
    "entry": 99612,
    "text": "Sets the position to an offset from the block's start (`0x01851C` to\n`0x018524`), with no bound, and sets no result, so r3 still has the stream's\naddress."
   },
   {
    "name": "TMemoryStream::Write",
    "entry": 99672,
    "text": "Copies a number of bytes from an address to the position (`BlockMove`,\n`0x018580`), moves the position past them and returns 0 (`0x018588` to\n`0x018594`)."
   },
   {
    "name": "TMemoryStream::Read",
    "entry": 99808,
    "text": "Copies a number of bytes from the position to an address (`BlockMove`,\n`0x018608`), moves the position past them and returns 0 (`0x018610` to\n`0x01861C`)."
   },
   {
    "name": "TMemoryStream::ReadTo",
    "entry": 99940,
    "text": "Copies the number of bytes that its third argument points to from the position,\nmoves the position on and returns 0 (`0x018684` to `0x0186A4`). The position\nmoves by the count as read again after the copy (`0x01869C`), which the copy has\nreplaced with the first 4 bytes copied, not by the number of bytes copied. The copy\ngoes to the address of that count, not to the address in the second argument,\nwhose register the routine overwrites unread (`0x018668`, `0x018670`), so the bytes\noverwrite the count and whatever follows it. No routine that calls a stream\ncalls through slot 32 (an inference from the virtual calls in the facts of the\nwhole program), so the game never runs this routine."
   }
  ]
 },
 "TSegStream": {
  "opening": "A segment of an archive read as a stream, the record that\n`TSegFile::StreamSegment` returns. It has the file's reference number at `+0`\n(a short), the segment's start in the file at `+4`, the position to read next at\n`+8` and the segment's end at `+12`, all offsets in the file. It is not a\n`TStream` and has no vtable.",
  "routines": [
   {
    "name": "TSegStream::ReadData",
    "entry": 506700,
    "text": "Reads a number of bytes at the position into an address (`FSRead`,\n`0x07BBC0`) and returns the File Manager's result. The routine cuts a read that would reach the segment's end to end there (`0x07BB64` to `0x07BB8C`). The routine\nmoves the position past the bytes before the read (`0x07BBA4` to `0x07BBB8`), so\na read that fails still moves it."
   },
   {
    "name": "TSegStream::Seek",
    "entry": 506892,
    "text": "Moves the position and returns 0. A mode of 1 puts it at the offset given from\nthe segment's start (`0x07BC10` to `0x07BC20`), and a mode of 3 moves it by the\noffset (`0x07BC2C` to `0x07BC3C`). Any other mode, 2 among them, leaves it\nwhere it was. A position below the start then becomes the start (`0x07BC40` to\n`0x07BC54`), and one past the end becomes the end (`0x07BC58` to\n`0x07BC6C`)."
   }
  ]
 },
 "TSegFileIterator": {
  "opening": "A walk through the resources of an archive in the order of their ids. The object\nhas the `TSegFile` at `+0` and the present id at `+4`, an unsigned short that is\n0 when the walk is over.",
  "routines": [
   {
    "name": "TSegFileIterator::TSegFileIterator",
    "entry": 503576,
    "text": "Starts a walk of the file given at id 255 (`0x07AF28` to `0x07AF3C`) and\nsteps once (`0x07AF40`), so the walk begins at the first resource from\n`0x0100` up and never visits page 0 of the table of contents."
   },
   {
    "name": "TSegFileIterator::pp",
    "entry": 503704,
    "text": "Steps to the next id whose entry in the table has a length other than 0. It adds\n1 to the id (`0x07AFA0` to `0x07AFA8`), and it passes over a page that is not in memory whole (`0x07AFB0` to `0x07AFEC`). It tests the entries of a page in memory from the id's place in it (`0x07AFFC` to `0x07B058`), and the step\nstops at the first with a length (`0x07B02C` to `0x07B038`). After id `0xFFFF`\nthe id wraps to 0, which ends the walk (`0x07B05C` to `0x07B064`, `0x07AFF0` to\n`0x07AFF8`)."
   }
  ]
 },
 "SegFileHeader": {
  "opening": "",
  "routines": [
   {
    "name": "SegFileHeader::CompatibleVersions",
    "entry": 35984,
    "text": "Compares two version numbers, each a short with a major number in its high byte\nand a minor number in its low byte. It returns 1 when the major numbers are\nequal and the first's minor number is at least the second's (`0x008CA8` to\n`0x008CBC`), and 0 otherwise (`0x008C90` to `0x008CA4`, `0x008CC0`).\nThe scenario's opening (`TDelverApp::OpenScenFile`) passes `0x1300` as the first and the scenario's version as the second, so the game opens a scenario only at version `0x13` with a minor number of 0."
   }
  ]
 },
 "TPixCacheFromCachedSegFiles": {
  "opening": "",
  "routines": [
   {
    "name": "TPixCacheFromCachedSegFiles::GetData",
    "entry": 475684,
    "text": "Returns the address of picture n in the cache, resource `0x8F00` plus n, through\nthe `TCachedSegFiles` at `+2568` (`TCachedSegFiles::GetSegment`, `0x074240` to\n`0x07424C`)."
   },
   {
    "name": "TPixCacheFromCachedSegFiles::DoneData",
    "entry": 475808,
    "text": "Frees a picture's copy in the cache by its address (`TCache::Free`, with the\nthird argument 1, `0x0742C0` to `0x0742D4`). The routine passes over an address of 0 (`0x0742BC`)."
   }
  ]
 },
 "TSavePort": {
  "opening": "",
  "routines": [
   {
    "name": "TSavePort::~TSavePort",
    "entry": 166808,
    "text": "Sets the port saved at `+0` back (`SetPort`, `0x028BB8`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TSaveGWorld": {
  "opening": "",
  "routines": [
   {
    "name": "TSaveGWorld::~TSaveGWorld",
    "entry": 198296,
    "text": "Sets the port and the device saved at `+4` and `+8` back (`SetGWorld`,\n`0x0306BC`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TSaveFont": {
  "opening": "",
  "routines": [
   {
    "name": "TSaveFont::~TSaveFont",
    "entry": 462264,
    "text": "Sets the font, the style and the size saved at `+0`, `+2` and `+4` back\n(`TextFont`, `TextFace` and `TextSize`, `0x070DD4` to `0x070DF0`), and frees the object when the flag is above 0."
   }
  ]
 },
 "THandleLocker": {
  "opening": "",
  "routines": [
   {
    "name": "THandleLocker::~THandleLocker",
    "entry": 474232,
    "text": "Sets the handle at `+0` back to the state saved in the low byte of `+4`\n(`HSetState`, `0x073C94` to `0x073CA0`), so a handle locked before stays locked, and frees the object when the flag is above 0."
   }
  ]
 },
 "TDrawToGWorld": {
  "opening": "",
  "routines": [
   {
    "name": "TDrawToGWorld::TDrawToGWorld",
    "entry": 441520,
    "text": "Saves the present port and device at `+0` and `+4` (`GetGWorld`, `0x06BCC8`)\nand draws from then on into the viewer's offscreen world at `+120` of the\nviewer, with no device (`SetGWorld`, `0x06BCD4` to `0x06BCE0`)."
   },
   {
    "name": "TDrawToGWorld::~TDrawToGWorld",
    "entry": 441652,
    "text": "Sets the port and device saved at `+0` and `+4` back (`SetGWorld`,\n`0x06BD58`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TWDEF": {
  "opening": "The base of the game's window definitions, the code behind the frames of its\nwindows. The object has its vtable at `+0`, the window's record at `+4`, and two\nbytes at `+8` and `+9` with the close box's and the zoom box's highlight. The\nvtable's slots are 8 the destructor, 12 `Draw`, 16 `DrawUnhilited`, 20\n`DrawHilited`, 24 `HiliteCloseBox`, 28 `HiliteZoomBox`, 40 `Grow`, 44\n`DrawSizeBox`, 48 `GetFeatures` and 52 `GetRegion`. Slots 32 and 36 are 0 in\n`TWDEF`'s vtable, for the subclasses to fill.",
  "routines": [
   {
    "name": "TWDEF::TWDEF",
    "entry": 457772,
    "text": "Sets the vtable and the window (`0x06FC2C` to `0x06FC40`), clears both\nhighlight bytes (`0x06FC4C`, `0x06FC50`), and sets the byte at `+113` of the\nwindow's record to 0 (`0x06FC48`), the flag for a zoom box. The variation code in\nthe third argument is not read. None of the four subclasses' constructors\n(`TBorderWDEF`, `TThinBorderWDEF`, `TPixsWDEF`, `TDrawerWDEF`) sets the flag again,\nso no window of these classes has a zoom box, and `Draw` reaches its zoom branch only if other code sets it (an inference)."
   },
   {
    "name": "TWDEF::~TWDEF",
    "entry": 457864,
    "text": "Sets the vtable back to `TWDEF`'s (`0x06FCA8` to `0x06FCB0`), and frees the object when the flag is above 0."
   },
   {
    "name": "TWDEF::Draw",
    "entry": 457984,
    "text": "Draws the frame or one of its boxes, by the part in the third argument. Part 4\nflips the close box's highlight at `+8` and, when the window has a close box\n(the byte at `+112` of its record), redraws the box through slot 24 (`0x06FD24`\nto `0x06FD64`). Parts 5 and 6 do the same for the zoom box, with `+9`, the byte\nat `+113` and slot 28 (`0x06FD70` to `0x06FDBC`). Any other part draws the whole\nframe, through slot 20 with both flags for a highlighted window (the byte\nat `+111`, `0x06FDC8` to `0x06FDF8`) and through slot 16 otherwise\n(`0x06FE04` to `0x06FE14`)."
   },
   {
    "name": "TWDEF::DrawUnhilited",
    "entry": 458332,
    "text": "Does nothing (`0x06FE5C`)."
   },
   {
    "name": "TWDEF::DrawHilited",
    "entry": 458380,
    "text": "Does nothing (`0x06FE8C`)."
   },
   {
    "name": "TWDEF::HiliteCloseBox",
    "entry": 458428,
    "text": "Does nothing (`0x06FEBC`)."
   },
   {
    "name": "TWDEF::HiliteZoomBox",
    "entry": 458480,
    "text": "Does nothing (`0x06FEF0`)."
   },
   {
    "name": "TWDEF::Grow",
    "entry": 458528,
    "text": "Frames the window's structure region, the region at `+114` of its record\n(`FrameRgn`, `0x06FF30` to `0x06FF3C`). The rectangle in the third argument is\nnot read, so the outline drawn during a resize is the window's present frame,\nnot the size the player drags, in every class that uses this routine (`TBorderWDEF`\nreplaces it)."
   },
   {
    "name": "TWDEF::DrawSizeBox",
    "entry": 458620,
    "text": "Does nothing (`0x06FF7C`)."
   },
   {
    "name": "TWDEF::GetFeatures",
    "entry": 458664,
    "text": "Returns 0 (`0x06FFA8`)."
   },
   {
    "name": "TWDEF::GetRegion",
    "entry": 458712,
    "text": "Returns -30593 (`0x06FFD8`) and leaves the region as it was."
   }
  ]
 },
 "TWDEFRegister": {
  "opening": "The table that picks a window definition object for a window. It has up to 20\nentries of 12 bytes from `data+0x6DB80`, with their count at `data+0x6DC74`. An\nentry is a `'WDEF'` resource id at `+0`, a mask at `+2`, a value at `+4` and the\nroutine that makes the object at `+8`. The routine descriptor that every\nregistered `'WDEF'` resource jumps to is at `data+0x6DC70`.",
  "routines": [
   {
    "name": "TWDEFRegister::TWDEFRegister",
    "entry": 458772,
    "text": "Readies the `'WDEF'` resource with the id given. The first one made also makes\nthe routine descriptor, for PowerPC code (`NewRoutineDescriptor` with 1,\n`0x070030` to `0x070050`). The resource's first six bytes then become a 68K\njump, `0x4EF9` and the descriptor's address (`0x070070` to `0x070088`), so a\nwindow that uses the resource runs the game's code. It makes the resource unpurgeable (`HNoPurge`, `0x07008C`) and sets the object's `+0` to the id (`0x070094`). The routine passes over a resource that is missing."
   },
   {
    "name": "TWDEFRegister::Register",
    "entry": 458972,
    "text": "Adds an entry to the table, with the object's resource id, the routine to call\nand the mask and value from the third and fourth arguments (`0x0700F8` to\n`0x070134`), and adds 1 to the count (`0x070138` to `0x070140`). With 20 entries already there, the routine drops the entry and nothing marks it (`0x0700EC` to `0x0700F4`)."
   },
   {
    "name": "TWDEFRegister::CreateController",
    "entry": 459164,
    "text": "Makes the window definition object for a window and a variation code. It tests\nthe entries in order (`0x07021C` to `0x070228`). An entry matches when its `'WDEF'` resource equals the window's definition, the handle at `+126` of its\nrecord (`0x0701C4` to `0x0701E0`), and the variation code masked by the entry's\nmask equals its value (`0x0701E4` to `0x0701F8`). It calls the first match's routine with the window and the variation code, and returns its result\n(`0x0701FC` to `0x070210`). With no match it returns 0 (`0x07022C`)."
   }
  ]
 },
 "TCDEF": {
  "opening": "The base of the game's control definitions, the code behind its push buttons,\ncheck buttons, radio buttons, number fields, progress bars and scroll bars. The object has its vtable\nat `+0` and the control's handle at `+4`. The vtable's slots are 8 the\ndestructor, 12 `Draw`, 16 `DrawAPart`, 20 `Test`, 24 `CalcControlRegion`, 28\n`CalcThumbRegion`, 32 `Pos`, 36 `Thumb`, 40 `Drag`, 44 `Action`, 48\n`GetFeatures`, 52 `GetData`, 56 `SetData`, 60 `DrawGhost`, 64\n`CalcValueFromPos`, 68 `CalcBestRect`, 72 `HandleTracking`, 76 `Focus`, 80\n`Idle`, 84 `Activate`, 88 `SetUpBackground`, 92 `KeyDown` and 96\n`GetPreferedCTable` [sic].",
  "routines": [
   {
    "name": "TCDEF::TCDEF",
    "entry": 453592,
    "text": "Sets the vtable and the control (`0x06EBD8` to `0x06EBE0`)."
   },
   {
    "name": "TCDEF::~TCDEF",
    "entry": 453660,
    "text": "Sets the vtable back to `TCDEF`'s and the control's reference to 0\n(`SetControlReference`, `0x06EC38` to `0x06EC48`), and frees the object when the flag is above 0."
   },
   {
    "name": "TCDEF::Draw",
    "entry": 453796,
    "text": "Draws the control through slot 16, `DrawAPart`, into an offscreen world, and\nthen copies the world into the window. It sets the\nport to the control's window and clips to the control's rectangle within the\npresent clip (`0x06ECF4` to `0x06ED58`), with a normal pen (`0x06ED60` to\n`0x06ED6C`). In a color port, one whose `+6` has its two top bits set\n(`0x06ECE0` to `0x06ECF0`), it saves the colors and locks the window's and the\ncontrol's color tables (`0x06ED7C` to `0x06EE08`). The world covers the\ncontrol's rectangle in global coordinates (`0x06EE0C` to `0x06EE50`). With a\ntable from slot 96 the world has 8 bits and that table, with the seed of the\nworld's table set to that table's (`0x06EE8C` to `0x06EEE0`), and otherwise the depth of the screen under the\nrectangle (`0x06EEE8` to `0x06EF00`). The world's origin is the rectangle's\ncorner, so `DrawAPart` draws in the window's coordinates (`0x06EF48` to\n`0x06EF54`). Before it, the routine fills the rectangle with the window's background,\nits pixel pattern in a color port whose background pixel pattern at `+32` is not\n0 (`FillCRect`, `0x06EF7C` to `0x06EFB0`), after which it sets the world's fill pixel pattern at `+62` to 0 and marks the port as changed (`0x06EFA0` to\n`0x06EFB0`), and its pattern otherwise (`FillRect`, `0x06EFBC` to `0x06EFC4`). The routine fills a color port with no background pixel pattern the second way, with the 8\nbytes at `+32` of a color port, the empty handle and part of the foreground\ncolor, read as a pattern. The arguments to\n`DrawAPart` are the control's record, the variation code, the part, the two color tables (0 in a\nport without color) and whether the port has color (`0x06EFCC` to\n`0x06EFF0`). The routine copies the world into the window and disposes of it (`0x06F004` to `0x06F044`), and sets the colors, the pen, the clip and the port back\n(`0x06F04C` to `0x06F0B4`). When making the world fails, the routine has `DrawAPart` draw straight into the window, with no background fill (`0x06EF18` to `0x06EF20`)."
   },
   {
    "name": "TCDEF::GetPreferedCTable",
    "entry": 454900,
    "text": "Returns 0, no color table (`0x06F0F4`)."
   },
   {
    "name": "TCDEF::DrawAPart",
    "entry": 454956,
    "text": "Does nothing (`0x06F12C`)."
   },
   {
    "name": "TCDEF::Test",
    "entry": 455044,
    "text": "Returns 1 when the point given is in the control's rectangle, the rectangle at\n`+8` of its record, and 0 otherwise (`PtInRect`, `0x06F198` to `0x06F1D0`)."
   },
   {
    "name": "TCDEF::CalcControlRegion",
    "entry": 455172,
    "text": "Sets the region given to the control's rectangle (`RectRgn`, `0x06F234` to\n`0x06F254`). The routine leaves a region handle of 0, or one whose region is 0, alone\n(`0x06F220` to `0x06F230`)."
   },
   {
    "name": "TCDEF::CalcThumbRegion",
    "entry": 455344,
    "text": "Does nothing (`0x06F2B0`)."
   },
   {
    "name": "TCDEF::Pos",
    "entry": 455404,
    "text": "Does nothing (`0x06F2EC`)."
   },
   {
    "name": "TCDEF::Thumb",
    "entry": 455444,
    "text": "Does nothing (`0x06F314`)."
   },
   {
    "name": "TCDEF::Drag",
    "entry": 455516,
    "text": "Returns 0 (`0x06F35C`)."
   },
   {
    "name": "TCDEF::Action",
    "entry": 455560,
    "text": "Does nothing (`0x06F388`)."
   },
   {
    "name": "TCDEF::GetFeatures",
    "entry": 455600,
    "text": "Returns 0 (`0x06F3B0`)."
   },
   {
    "name": "TCDEF::GetData",
    "entry": 455648,
    "text": "Returns -30581 (`0x06F3E0`). The control definition (`MyCDEF`) sends both the message to set data and the one to get it to slot 56, `SetData`, so no call from there reaches this routine, and no subclass replaces either."
   },
   {
    "name": "TCDEF::SetData",
    "entry": 455700,
    "text": "Returns -30581 (`0x06F414`)."
   },
   {
    "name": "TCDEF::DrawGhost",
    "entry": 455752,
    "text": "Does nothing (`0x06F448`)."
   },
   {
    "name": "TCDEF::CalcValueFromPos",
    "entry": 455808,
    "text": "Does nothing (`0x06F480`)."
   },
   {
    "name": "TCDEF::CalcBestRect",
    "entry": 455872,
    "text": "Does nothing (`0x06F4C0`)."
   },
   {
    "name": "TCDEF::HandleTracking",
    "entry": 455924,
    "text": "Returns 0 (`0x06F4F4`)."
   },
   {
    "name": "TCDEF::Focus",
    "entry": 456004,
    "text": "Returns 0 (`0x06F544`)."
   },
   {
    "name": "TCDEF::Idle",
    "entry": 456048,
    "text": "Does nothing (`0x06F570`)."
   },
   {
    "name": "TCDEF::Activate",
    "entry": 456088,
    "text": "Does nothing (`0x06F598`)."
   },
   {
    "name": "TCDEF::SetUpBackground",
    "entry": 456132,
    "text": "Does nothing (`0x06F5C4`)."
   },
   {
    "name": "TCDEF::KeyDown",
    "entry": 456184,
    "text": "Returns 0 (`0x06F5F8`)."
   }
  ]
 },
 "TCDEFRegister": {
  "opening": "The table that picks a control definition object for a control, built as\n`TWDEFRegister`'s is for windows. It has up to 20 entries of 12 bytes from\n`data+0x6DA88`, with their count at `data+0x6DB7C`. An entry is a `'CDEF'`\nresource id at `+0`, a mask at `+2`, a value at `+4` and the routine that makes\nthe object at `+8`. The routine descriptor that every registered `'CDEF'`\nresource jumps to is at `data+0x6DB78`.",
  "routines": [
   {
    "name": "TCDEFRegister::TCDEFRegister",
    "entry": 456232,
    "text": "Readies the `'CDEF'` resource with the id given. The first one made also makes\nthe routine descriptor, for PowerPC code (`NewRoutineDescriptor` with 1,\n`0x06F644` to `0x06F664`). The resource's first six bytes then become a 68K\njump, `0x4EF9` and the descriptor's address (`0x06F684` to `0x06F69C`), so a\ncontrol that uses the resource runs the game's code. It makes the resource unpurgeable (`HNoPurge`, `0x06F6A0`) and sets the object's `+0` to the id (`0x06F6A8`). The routine passes over a resource that is missing."
   },
   {
    "name": "TCDEFRegister::Register",
    "entry": 456432,
    "text": "Adds an entry to the table, with the object's resource id, the routine to call\nand the mask and value from the third and fourth arguments (`0x06F70C` to\n`0x06F748`), and adds 1 to the count (`0x06F74C` to `0x06F754`). With 20 entries already there, the routine drops the entry and nothing marks it (`0x06F700` to `0x06F708`)."
   },
   {
    "name": "TCDEFRegister::CreateController",
    "entry": 456624,
    "text": "Makes the control definition object for a control and a variation code. It\ntests the entries in order (`0x06F834` to `0x06F840`). An entry matches when its\n`'CDEF'` resource is the control's definition, the handle at `+24` of its record\n(`0x06F7D8` to `0x06F7F8`), and the variation code masked by the entry's mask\nequals its value (`0x06F7FC` to `0x06F810`). It calls the first match's routine with the control and the variation code, and returns its result (`0x06F814` to\n`0x06F828`). With no match the result is a plain `TCDEF`, 8 bytes, for the\ncontrol (`0x06F844` to `0x06F868`), unlike the window table, which returns 0."
   }
  ]
 },
 "XInterp": {
  "opening": "The base of the script interpreter's exceptions, `XIInvalidOpcode`,\n`XIInvalidSegment`, `XIInvalidVAddr`, `XIRaise` and `XIEndGame`. It has a\nvtable and no fields.",
  "routines": [
   {
    "name": "XInterp::~XInterp",
    "entry": 526572,
    "text": "Sets the vtable to `XInterp`'s (`0x080908` to `0x080914`), and frees the object when the flag is above 0."
   }
  ]
 },
 "XIInvalidOpcode": {
  "opening": "The exception that the script interpreter throws at an opcode with no case, with the type string `\"!XInterp!!XIInvalidOpcode!!\"`, a subclass of `XInterp`.",
  "routines": [
   {
    "name": "XIInvalidOpcode::~XIInvalidOpcode",
    "entry": 526280,
    "text": "Sets the vtable to `XIInvalidOpcode`'s and then to `XInterp`'s, as the base's destructor\ndoes (``0x0807E4`` to ``0x0807F8``), and frees the object when the flag is above 0."
   }
  ]
 },
 "XIInvalidSegment": {
  "opening": "The exception that the script interpreter throws when a script segment is missing, with the type string `\"!XInterp!!XIInvalidSegment!!\"`, a subclass of `XInterp`.",
  "routines": [
   {
    "name": "XIInvalidSegment::~XIInvalidSegment",
    "entry": 526424,
    "text": "Sets the vtable to `XIInvalidSegment`'s and then to `XInterp`'s, as the base's destructor\ndoes (``0x080874`` to ``0x080888``), and frees the object when the flag is above 0."
   }
  ]
 },
 "XIInvalidVAddr": {
  "opening": "The exception that the script interpreter throws at an address that `TInterp::VAddrToPtr` cannot turn into a pointer, with the type string `\"!XInterp!!XIInvalidVAddr!!\"`, a subclass of `XInterp`.",
  "routines": [
   {
    "name": "XIInvalidVAddr::~XIInvalidVAddr",
    "entry": 537388,
    "text": "Sets the vtable to `XIInvalidVAddr`'s and then to `XInterp`'s, as the base's destructor\ndoes (``0x083348`` to ``0x08335C``), and frees the object when the flag is above 0."
   }
  ]
 },
 "XIRaise": {
  "opening": "The exception that the script interpreter throws for the `ai_state` statement. The interpreter (`TInterp::DoInterpAt`) makes it, 16 bytes, with\nthe string \"Raise\" at `+4`, the state's number at `+8` and a value at `+12`, and\n`TInterp::~TInterp` throws it, a subclass of `XInterp`.",
  "routines": [
   {
    "name": "XIRaise::~XIRaise",
    "entry": 540836,
    "text": "Sets the vtable to `XIRaise`'s and then to `XInterp`'s, as the base's destructor\ndoes (``0x0840C0`` to ``0x0840D4``), and frees the object when the flag is above 0."
   }
  ]
 },
 "XIEndGame": {
  "opening": "The exception that the script interpreter throws to end the game, with the type string `\"!XInterp!!XIEndGame!!\"`, a subclass of `XInterp`.",
  "routines": [
   {
    "name": "XIEndGame::~XIEndGame",
    "entry": 533964,
    "text": "Sets the vtable to `XIEndGame`'s and then to `XInterp`'s, as the base's destructor\ndoes (``0x0825E8`` to ``0x0825FC``), and frees the object when the flag is above 0."
   }
  ]
 },
 "TAudit": {
  "opening": "",
  "routines": [
   {
    "name": "TAudit::TAudit",
    "entry": 728640,
    "text": "Sets the vtable and two shorts at `+4` and `+6` to 0 (`0x0B1E40` to `0x0B1E54`)."
   },
   {
    "name": "TAudit::AuditStartup",
    "entry": 728704,
    "text": "Does nothing (`0x0B1E80`)."
   }
  ]
 },
 "TAdjustTaskMaster": {
  "opening": "",
  "routines": [
   {
    "name": "TAdjustTaskMaster::~TAdjustTaskMaster",
    "entry": 117516,
    "text": "Sets the task master's short at `data+0x6260A` back to the value saved at `+0`\n(`0x01CB2C` to `0x01CB38`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TImageObject": {
  "opening": "",
  "routines": [
   {
    "name": "TImageObject::Tick",
    "entry": 645088,
    "text": "Does nothing (`0x09D7E0`)."
   },
   {
    "name": "TImageObject::Apply",
    "entry": 645136,
    "text": "Does nothing (`0x09D810`)."
   }
  ]
 },
 "TBres": {
  "opening": "A walk along a straight line from one point to another, square by square, that\ncalls slot 8 of its vtable, `DoBresPixel`, at each step. The object has its\nvtable at `+0` and an x and a y at `+4` and `+8`.",
  "routines": [
   {
    "name": "TBres::DrawBres",
    "entry": 477364,
    "text": "Walks the line from (x0, y0) to (x1, y1), the first four arguments, and calls\n`DoBresPixel` with an index that starts at the fifth argument and moves by the\nsixth for each step in x and by the seventh for each step in y (`0x074904` to\n`0x074930`, negated for a line going left or up). It sets `+4` and `+8` to x0 and\ny0 (`0x0748F0`, `0x0748FC`). At each step it adds 0 to them (`0x0748BC`,\n`0x0748D4`, `0x074978`, `0x0749E4`), so they stay at the start for the whole\nwalk. When the line is longer in x than in y it makes one step in x each time,\nand one in y as well when the running error, raised by the y distance at each\nstep, passes the x distance (`0x074940` to `0x0749A4`). Otherwise y leads in the\nsame way (`0x0749AC` to `0x074A10`), a line as long in x as in y among them. The\nwalk visits the longer distance plus 1 squares, and stops early at the first\n`DoBresPixel` that returns 0 (`0x074964`, `0x0749D0`). The error starts at 0\n(`0x074938`) and the shorter axis moves only once it exceeds the longer distance\n(`0x074974` to `0x074984`, `0x0749E0` to `0x0749F0`), after the visit to the square, so the walk ends one square short of the end on the shorter axis unless the line\nis level or upright. A diagonal from (0, 0) to (3, 3) visits (0, 0), (0, 1),\n(1, 2) and (2, 3). The line of sight's callers (`TViewer::IsStraightRel` and\n`IsStraightAbs`) therefore test a neighbor of the target last, not the target.\nThe missiles' `DoBresPixel` (`TMissileThrower` and `TMissileSpinner`) place their\nsound from `+4` and `+8` (`TSoundTracker::MoveTo`), so a flying missile's sound\nstays where the throw began. Few shipped missiles have a flight sound to place. A\nthrow by the throw command passes sound 0, which plays nothing. The combat\nscript `0x3042` passes a thrown weapon's sound or element 1 of an ammunition's\narray, which are 13 and 14, resources the archive lacks, for every such item but\nthe rolling pin, whose sound 15 lasts a quarter of a second."
   },
   {
    "name": "TBres::DoBresPixel",
    "entry": 477780,
    "text": "Returns 1, to go on (`0x074A54`)."
   }
  ]
 },
 "TStraightBres": {
  "opening": "",
  "routines": [
   {
    "name": "TStraightBres::DoBresPixel",
    "entry": 441788,
    "text": "Tests bit 2 (the value 4) of the first word of entry n of the table of 8-byte\nentries at `+12` (`0x06BDBC` to `0x06BDC8`). With the bit set it writes 0 to the\nbyte at the address at `+16` and returns 0, which ends the walk (`0x06BDD0` to\n`0x06BDE0`), and otherwise it returns 1 (`0x06BDE4`). Its use in\n`TViewer::IsStraightRel` and `TViewer::IsStraightAbs` points to a test of a\nstraight line across the map that a blocking square stops (an inference)."
   }
  ]
 },
 "TConvMode": {
  "opening": "The base of the modes that a conversation waits in for the player, such as a\nresponse, a \"how many\" or a choice. The object has its vtable at `+0`, the\n`TInteraction` at `+4` and a byte at `+8`. The vtable's slots are 8 the\ndestructor, 12 `DrawRoutine`, 16 `MouseRoutine`, 20 `IdleRoutine`, 24\n`CursorRoutine`, 28 `KeyRoutine` and 32 `WantAutoKey`. The application object\nis the one at `data+0x60E0C`.",
  "routines": [
   {
    "name": "TConvMode::DrawRoutine",
    "entry": 245608,
    "text": "Does nothing (`0x03BF68`)."
   },
   {
    "name": "TConvMode::MouseRoutine",
    "entry": 245800,
    "text": "Does nothing (`0x03C028`)."
   },
   {
    "name": "TConvMode::IdleRoutine",
    "entry": 245992,
    "text": "Does nothing (`0x03C0E8`)."
   },
   {
    "name": "TConvMode::CursorRoutine",
    "entry": 246216,
    "text": "Does nothing (`0x03C1C8`)."
   },
   {
    "name": "TConvMode::KeyRoutine",
    "entry": 246428,
    "text": "Does nothing (`0x03C29C`)."
   },
   {
    "name": "TConvMode::TConvMode",
    "entry": 248284,
    "text": "Sets the vtable and the interaction, and clears the byte at `+8` (`0x03C9DC` to `0x03C9EC`)."
   },
   {
    "name": "TConvMode::Perform",
    "entry": 248360,
    "text": "Runs the game's event loop until the mode ends. It drops pending mouse and key\nevents (`FlushEvents` with 10, `0x03CA50` to `0x03CA54`), clears the\napplication's bytes at `+28` and `+32` (`0x03CA5C` to `0x03CA74`), and disables\nthe whole File menu, menu 129 (`0x03CA6C` to `0x03CA98`). It sets the byte at `+33` of the application to the opposite of the mode's `WantAutoKey` for the loop and back after it (`0x03CAA0` to `0x03CACC`, `0x03CAEC`). The loop is\nthe application's slot 24, `TApp::MEL` (`0x03CAD0` to `0x03CADC`), which returns\nonce `Done` sets `+28`. It enables the File menu again when the menu was on before (`0x03CAE8` to `0x03CB04`), clears the application's `+28` and sets `+32` to 1 (`0x03CB0C` to `0x03CB20`). The routine reads the menu's flags before it tests the handle for 0 (`0x03CA84` to `0x03CA8C`)."
   },
   {
    "name": "TConvMode::WantAutoKey",
    "entry": 248684,
    "text": "Returns 1 (`0x03CB6C`)."
   },
   {
    "name": "TConvMode::Done",
    "entry": 248736,
    "text": "Sets the application's byte at `+28` to 1, which ends `Perform`'s loop (`0x03CBA0` to `0x03CBAC`)."
   },
   {
    "name": "TConvMode::~TConvMode",
    "entry": 249816,
    "text": "Sets the vtable back to `TConvMode`'s (`0x03CFF8` to `0x03D000`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TPrefs": {
  "opening": "The preferences file, `Cythera Preferences`, and its keys. The object is 2\nbytes, the file's reference number, and there is one, at `data+0x60E10`. Each\nkey is a `'Pref'` resource named for it.",
  "routines": [
   {
    "name": "TPrefs::OpenPrefsResFile",
    "entry": 67344,
    "text": "Opens the preferences file with the permission given and returns its reference\nnumber, or -1 on any failure (`0x01071C`, `0x0107F8`). The name comes from\n`GetPrefsName` (`0x010734`), and the folder is the Preferences folder of the\nSystem Folder, made when it is missing (`FindFolder`, `0x010748` to\n`0x010760`). When the file does not exist and the second argument is other than 0, the routine makes it with the type `'pref'` and the creator at toc -4124 (`FSpCreateResFile`,\n`0x010790` to `0x0107C8`), the long at `data+0x6FE4`, `'????'`, which nothing\nwrites (`0x0107A8` to `0x0107B4`), so the file's creator is not the game's `'Delv'`. Then the routine opens it (`FSpOpenResFile`, `0x0107DC` to `0x0107E4`)."
   },
   {
    "name": "TPrefs::GetPrefsName",
    "entry": 67648,
    "text": "Copies the file's name, the string resource whose id is the short at toc\n-4128, into the buffer given, and returns 0 (`0x010848` to `0x010888`), or\n-192 when the resource is missing (`0x010894`)."
   },
   {
    "name": "TPrefs::TPrefs",
    "entry": 67808,
    "text": "Opens the file for reading and writing, made when it is missing, and stores its\nreference number at `+0` (`0x0108F0` to `0x010900`) untested, so a failed open\nleaves -1 there, every later `UseResFile(-1)` fails, and the routines' writes\ngo to whatever resource file is current (an inference from the Resource\nManager's rules)."
   },
   {
    "name": "TPrefs::Instance",
    "entry": 67904,
    "text": "Returns the one `TPrefs`, made on the first call (`0x010948` to `0x010980`). When\nthe allocation fails it returns 0, and the next call tries again."
   },
   {
    "name": "TPrefs::GetFile",
    "entry": 68040,
    "text": "Resolves the alias stored under a key into the file record given and returns 0\n(`ResolveAlias`, `0x010A10` to `0x010A20`). A missing key returns the Resource\nManager's error (`0x010A04`), and a failed resolution its error (`0x010A34`).\nWhen the alias changed in the resolution the routine writes it back to the preferences file (`0x010A3C` to `0x010A68`)."
   },
   {
    "name": "TPrefs::SetFile",
    "entry": 68284,
    "text": "Stores an alias to the file record given under a key, in the preferences file.\nIt first removes and disposes of an old value there (`0x010AFC` to `0x010B38`).\nIt adds the alias under the first id from `UniqueID` that is 128 or more\n(`0x010B84` to `0x010BC0`), and the routine returns the Resource Manager's\nerror (`0x010BE0`), taken after the earlier resource file becomes current again (`0x010BD4`), so it reports that call, and an error from `AddResource`\n(`0x010BC0`) or `UpdateResFile` (`0x010BCC`) never reaches the caller. When the removal or `NewAlias` fails it returns that error\nat once (`0x010B54`, `0x010B7C`), with the preferences file still the current\nresource file."
   },
   {
    "name": "TPrefs::SavePrefs",
    "entry": 68652,
    "text": "Stores a record of the length given under a key, in the preferences file. A key\nnot there yet starts from the copy that the open resource files have, the\napplication's among them, detached (`0x010C90` to `0x010CB0`), or from a cleared\nhandle of the length (`0x010CBC` to `0x010CC8`), added under the first id from\n`UniqueID` that is 128 or more (`0x010CE0` to `0x010D1C`). The handle grows to\nthe length when it is shorter and never shrinks (`0x010D30` to `0x010D4C`), with\nthe result of `SetHandleSize` untested, so the copy would run past a failed growth. It copies the record in and writes it (`0x010D54` to `0x010D84`). When no handle can\nbe had the routine does nothing (`0x010CCC` to `0x010CD0`)."
   },
   {
    "name": "TPrefs::LoadPrefs",
    "entry": 69072,
    "text": "Copies the length given of a key's record into the buffer given, from any open\nresource file, and returns 1 when it found the key and 0 otherwise\n(`0x010DD8` to `0x010E28`). The length is not compared with the record's\nsize."
   },
   {
    "name": "TPrefs::GetOrdinal",
    "entry": 69232,
    "text": "Returns long n of a key's value, from any open resource file (`0x010EE0` to\n`0x010EEC`). It returns the default in the third argument for a missing key\n(`0x010EAC` to `0x010EB0`) and for a value with more than n + 1 longs\n(`0x010EB8` to `0x010ED8`). So for n of 0 a value of 8 bytes or more gives the\ndefault, and for one of fewer than 4 bytes the read runs past its end."
   },
   {
    "name": "TPrefs::SetOrdinal",
    "entry": 69436,
    "text": "Stores long n of a key's value, in the preferences file. A key not there yet\nstarts from the copy that the open resource files have, detached (`0x010FA0` to\n`0x010FC0`), or from a cleared handle of n longs (`0x010FCC` to `0x010FD8`),\nadded under the first id from `UniqueID` that is 128 or more (`0x010FEC` to\n`0x011028`). A value shorter than n + 1 longs grows to that, with the added\nlongs set to 0 (`0x01103C` to `0x0110B8`). Then it sets long n and writes the value (`0x0110BC` to `0x0110EC`). The routine tests no result of `NewHandleClear` or `SetHandleSize`."
   }
  ]
 },
 "GMSTune": {
  "opening": "One QuickTime Music piece, a spot or an ambient tune, played through the tune\nplayer at `data+0x62564` at the volume in the short at `data+0x62560`. The\nobject has the tune's address at `+0`, the place to resume from at `+4`, in\nlongs from the start of its notes, and a byte at `+8` that is 1 for a tune that\nrepeats. A tune has the offset of its notes from its start in its first long\nand its header from `+20`. The tune player's volume is the volume times 8,192, so a volume of 8 gives 1.0 (an inference from the shift by 13).",
  "routines": [
   {
    "name": "GMSTune::GMSTune",
    "entry": 106736,
    "text": "Sets the tune, the place to resume from to 0 and the byte for a repeat (`0x01A0F0` to `0x01A0FC`)."
   },
   {
    "name": "GMSTune::~GMSTune",
    "entry": 106796,
    "text": "Stops the tune (`GMSTune::Stop`, `0x01A14C`), and frees the object when the flag is above 0."
   },
   {
    "name": "GMSTune::Pause",
    "entry": 106920,
    "text": "Records how far the tune has played, in longs, at `+4`, from the tune player's\nstatus (`TuneGetStatus`, `0x01A1CC` to `0x01A1D4`, and `0x01A1FC` to\n`0x01A214`), then stops the player, sets its volume to 0 and releases its notes\n(`0x01A1DC` to `0x01A21C`). The status gives the place within the piece last\nqueued, and `Resume` queues from the notes' start plus that place, so a second\npause after a resume records less than the tune has played in all (an\ninference from `TuneStatus` in `QuickTimeMusic.h`)."
   },
   {
    "name": "GMSTune::Resume",
    "entry": 107100,
    "text": "Plays the tune from the place recorded at `+4`. It sets the header and readies\nthe player (`0x01A284` to `0x01A29C`), queues the notes from the place\n(`0x01A2A4` to `0x01A2DC`) (`TuneQueue` with the rate 1.0, the whole piece and the flag\n`kTuneStartNow`, from `QuickTimeMusic.h` in the references), and sets the volume (`0x01A2E4` to `0x01A2F4`). It\ndoes nothing when there is no tune player, and unlike `Play` it runs at a volume\nof 0."
   },
   {
    "name": "GMSTune::Stop",
    "entry": 107324,
    "text": "Stops the tune player, releases its notes and sets its volume to 0 (`0x01A35C` to `0x01A380`), when there is a player."
   },
   {
    "name": "GMSTune::Play",
    "entry": 107456,
    "text": "Plays the tune from its start. It sets the header, readies the player and sets\nthe volume (`0x01A3FC` to `0x01A428`), then queues the notes (`0x01A430` to\n`0x01A45C`) (`TuneQueue` with the rate 1.0, the whole piece and the flag\n`kTuneStartNow`, from `QuickTimeMusic.h` in the references) and sets the volume again (`0x01A464` to `0x01A470`). It does\nnothing at a volume of 0 or with no tune player (`0x01A3E4` to\n`0x01A3F8`)."
   },
   {
    "name": "GMSTune::Idle",
    "entry": 107704,
    "text": "Returns 1 when the tune has ended and does not repeat, and 0 otherwise. With no\npiece queued (the queue count of the player's status, `0x01A4F0` to `0x01A508`),\nthe routine queues a repeating tune again from its start and returns 0\n(`0x01A50C` to `0x01A54C`). At a volume of 0, or with no tune player, it\nreturns 0 (`0x01A4D8` to `0x01A4EC`, `0x01A55C`)."
   }
  ]
 },
 "TJournalSegment": {
  "opening": "The player's journal, read and written as one stream of bytes that resources of 8,192 bytes from `0xE000` up hold, resource `0xE000` plus the position\ndivided by 8,192. The object has the position at `+0`, the journal's length at\n`+4`, the position of the block in memory at `+8`, a multiple of 8,192, and a\nbyte at `+12` that is 1 when the block has changes not yet saved. The block is\nthe buffer of 8,192 bytes whose address is at toc -29516. The archives are the\n`TCachedSegFiles` at `data+0x181EC`.",
  "routines": [
   {
    "name": "TJournalSegment::TJournalSegment",
    "entry": 490112,
    "text": "Finds the journal's length by adding the lengths of the resources from `0xE000`\nup to the first one with a length of 0 (`0x077AA4` to `0x077AEC`). It then\nmoves to the position given, or to the end for -1 (`0x077AF4` to `0x077B1C`).\nThe routine compares the limit of `0xF000` with the id as a signed short, which is always lower, so only a missing resource ends the count (`0x077ADC` to\n`0x077AEC`)."
   },
   {
    "name": "TJournalSegment::~TJournalSegment",
    "entry": 490344,
    "text": "Saves the block (`Flush`, `0x077B88`) and the newest archive's table\n(`TCachedSegFiles::Flush`, `0x077B90` to `0x077B98`), and frees the object when the flag is above 0."
   },
   {
    "name": "TJournalSegment::Flush",
    "entry": 490492,
    "text": "Saves the block when it has changes, as its resource (`TCachedSegFiles::SaveSegment`,\n`0x077C48` to `0x077C6C`), and marks it saved (`0x077C74` to `0x077C78`). It saves the block whole, 8,192 bytes, or up to the journal's end when the end lies within it (`0x077C20` to `0x077C44`)."
   },
   {
    "name": "TJournalSegment::SeekTo",
    "entry": 490692,
    "text": "Saves the block (`Flush`, `0x077CE4`), loads the block with the position\ngiven in it (`TCachedSegFiles::LoadSegment`, `0x077CE8` to `0x077D18`) and sets the\nposition (`0x077D20`)."
   },
   {
    "name": "TJournalSegment::Read",
    "entry": 490864,
    "text": "Copies the number of bytes that the first argument points to from the position\ninto the buffer given, and moves the position past them. A read past the end stops there, with its count set to what remains, and returns -39\n(`0x077D90` to `0x077DB8`). Otherwise it returns 0. The copy goes block by\nblock, loading the next block when it reaches the end of one (`0x077DF0` to\n`0x077E58`)."
   },
   {
    "name": "TJournalSegment::Write",
    "entry": 491180,
    "text": "Copies the number of bytes that the first argument points to from the buffer\ngiven to the position, block by block, and moves the position past them\n(`0x077EE8` to `0x077F80`). It marks each block it writes into as changed\n(`0x077F0C` to `0x077F10`, `0x077F40` to `0x077F44`). A write that fills a block\nto its end makes the journal at least that long (`0x077F4C` to `0x077F6C`)\nbefore the next block comes in, and the length becomes the position when the\nposition is past it (`0x077F8C` to `0x077FA0`). It returns 0."
   },
   {
    "name": "TJournalSegment::GetPos",
    "entry": 491500,
    "text": "Stores the position through the pointer given and returns 0 (`0x077FEC` to `0x077FF4`)."
   }
  ]
 },
 "TStaticImageObject": {
  "opening": "A picture drawn once into an offscreen world and then copied into a work area.\nThe object has a place at `+4` (v, then h), a transfer mode at `+8`, the world\nat `+12` and the picture's rectangle in the world at `+16`.",
  "routines": [
   {
    "name": "TStaticImageObject::Apply",
    "entry": 650552,
    "text": "Copies the rectangle at `+16` from the world into the work area's port, the\nport at `+0` of the work area, with the mode at `+8` and no mask (`CopyBits`,\n`0x09EDAC` to `0x09EDCC`). The rectangle's top left goes to the place at `+4`\nplus the work area's offset at `+4` (`0x09ED54` to `0x09EDA4`)."
   },
   {
    "name": "TStaticImageObject::LoadPicture",
    "entry": 650792,
    "text": "Draws a picture into the world, centered in the rectangle at `+16`. It fills the\nrectangle with QuickDraw's black pattern, `+186` of the QuickDraw globals at toc\n-30444 (named from their offsets, an inference) (`FillRect`,\n`0x09EE74` to `0x09EE94`), moves the picture's frame to the rectangle's middle,\nhalves rounded toward 0 (`0x09EE9C` to `0x09EF00`), and draws the picture\nthere (`DrawPicture`, `0x09EF08` to `0x09EF10`), with no clip, so a picture larger\nthan the rectangle draws over the world around it. The routine reads the picture's handle with no test for 0 (`0x09EE74`). The routine saves the port and device before and sets them back after (`0x09EE4C` to `0x09EE6C`, `0x09EF18` to `0x09EF28`)."
   }
  ]
 },
 "TScrollBarCDEF": {
  "opening": "The game's scroll bar, a `TCDEF`, vertical only, 16 pixels wide. From the top it\nhas an up arrow of 16 pixels, the track, and a down arrow of 16 pixels. The\nthumb is 16 pixels tall, and its track is the control's height less 48. The\nart is two 32-by-32 images of 8 bits, by the pixel map record at toc -5276\n(rows of 32 bytes, `bounds` 32 by 32), at `+0x6B400` and `+0x6B800` of the\nbuffer that `data+0x60564` points to, the second for a part held down. Each\nimage has the up arrow at (0, 0), the down arrow at (0, 16), the thumb and\nthe track's top at (16, 0), the track's middle from (16, 8) and its bottom at\n(16, 16), each 16 pixels square (as `x`, `y`). The part codes are 20 for the up\narrow, 21 for the down arrow, 22 and 23 for the track above and below the\nthumb, and 129 for the thumb.",
  "routines": [
   {
    "name": "TScrollBarCDEF::CalcThumbRegion",
    "entry": 685716,
    "text": "Sets the region given to the thumb's square, 16 by 16 at the control's left and\nthe thumb's top (`CalcThumb`, `0x0A76D8` to `0x0A7700`)."
   },
   {
    "name": "TScrollBarCDEF::TScrollBarCDEF",
    "entry": 685920,
    "text": "Makes a `TCDEF` for the control (`0x0A7784`) and sets the vtable to `TScrollBarCDEF`'s (`0x0A778C` to `0x0A7794`)."
   },
   {
    "name": "TScrollBarCDEF::Create",
    "entry": 686056,
    "text": "Allocates 8 bytes and makes a scroll bar in them for the control given (`0x0A77FC` to `0x0A7820`), and returns it, or 0 when the allocation fails."
   },
   {
    "name": "TScrollBarCDEF::CalcThumb",
    "entry": 686204,
    "text": "Returns the thumb's top, the control's top plus 16, plus the track times the\nvalue less the minimum, over the maximum less the minimum (`0x0A78D8` to\n`0x0A7904`). With a track under 16 pixels, or a maximum not above the minimum,\nit is the top plus 16 (`0x0A78C4` to `0x0A78D4`, `0x0A790C` to `0x0A7910`)."
   },
   {
    "name": "TScrollBarCDEF::Pos",
    "entry": 686416,
    "text": "Sets the value from the thumb moved by the distance given in its third argument,\nand draws the whole control again through slot 12 (`0x0A7AA4` to `0x0A7AC4`).\nA thumb moved above the track's top gives the minimum (`0x0A79FC` to\n`0x0A7A14`), and one at or below its foot the maximum (`0x0A7A1C` to\n`0x0A7A3C`). Between, the value is the minimum plus the range times the\nthumb's distance down the track over the track, rounded to the nearest\n(`0x0A7A44` to `0x0A7AA0`). The value goes straight into the control's record at\n`+18` (`0x0A7AB8`). With a track under 16 pixels or an empty range the value\nbecomes the minimum (`0x0A7AD0` to `0x0A7AFC`)."
   },
   {
    "name": "TScrollBarCDEF::Thumb",
    "entry": 686916,
    "text": "Fills in the limits for dragging the thumb. The record given has the point\npressed in its first four bytes. The drag is vertical only (`+16` set to 2,\n`0x0A7B60` to `0x0A7B68`). The limit rectangle is the point's h left and right,\nand from the track's top to the control's bottom less 31, both moved by the\npoint's distance below the thumb's top (`0x0A7B94` to `0x0A7BC8`). The bottom\nis 1 pixel lower than the thumb's last place, bottom less 32, and `Pos` gives\nthe maximum there. The slop rectangle is the control's rectangle widened by 8\non each side and by 32 above and below (`0x0A7BD0` to `0x0A7BF4`)."
   },
   {
    "name": "TScrollBarCDEF::Test",
    "entry": 687204,
    "text": "Returns the part at a point, 0 outside the control's rectangle (`0x0A7CA0` to\n`0x0A7CAC`), 20 in the top 16 pixels (`0x0A7CB0` to `0x0A7CC4`), 21 in the\nbottom 16 (`0x0A7CCC` to `0x0A7CE4`), 22 above the thumb, 23 below it, and 129\non it (`0x0A7CEC` to `0x0A7D30`). The thumb's place comes from `CalcThumb`\nwhether or not `DrawAPart` draws a thumb, so with an empty range, a bar of 48 pixels or\nless, or an inactive bar, the 16 pixels below the up arrow still answer 129,\nand the highlight goes untested. A drag there with an empty range ends with the\nvalue at the minimum."
   },
   {
    "name": "TScrollBarCDEF::DrawAPart",
    "entry": 687496,
    "text": "Draws the whole scroll bar into the present port by `CopyBits` from the art.\nThe routine replaces the part in its third argument with 0 before any test (`0x0A7D90`,\n`0x0A7D9C`), so every part's test passes and every call draws all of it. It\ndraws the up arrow, from the held image when the control's highlight, the byte\nat `+17` of its record, is 20 (`0x0A7E78` to `0x0A7EE4`). Then the track, when\nthe control is more than 32 pixels tall (`0x0A7F0C` to `0x0A80B4`), with its\ntop 16 pixels below the arrow, its middle in steps of 16 down to the down arrow's\nplace less 16, and its bottom piece last, the last place overdrawing what is\nthere. Then the down arrow, from the held image for a highlight of 21\n(`0x0A80D0` to `0x0A816C`). The thumb, from the held image always, comes last\nwhen the control is active (a highlight other than 255), the minimum is below\nthe maximum and the control is more than 48 pixels tall (`0x0A8174` to\n`0x0A8278`)."
   },
   {
    "name": "TScrollBarCDEF::~TScrollBarCDEF",
    "entry": 690004,
    "text": "Sets the vtable to `TScrollBarCDEF`'s and destroys the `TCDEF` (`0x0A8770` to `0x0A8780`), and frees the object when the flag is above 0."
   },
   {
    "name": "TScrollBarCDEF::GetPreferedCTable",
    "entry": 690148,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A87E4` to `0x0A87E8`)."
   }
  ]
 },
 "TBaseDragger": {
  "opening": "The image that follows the pointer while the player drags something from a\nwindow, drawn straight onto the screen over everything. The object has the\nimage's rectangle at its origin at `+0`, its rectangle on the screen at `+8`,\nthe same rectangle as `+0` again at `+16`, and a list at `+24` with one record of\n16 bytes for each screen, with the device at `+0`, a world with what is under the\nimage at `+4`, a world for the image over it at `+8`, and the next record at\n`+12`. It has a copy of the image's pixel map at `+28`, a copy of the mask's at\n`+78`, a byte at `+128` that is 1 with a mask, the Window Manager's color port\nat `+132`, a region at `+136`, the image's width and height at `+140` and\n`+144`, the pointer's last h and v at `+148` and `+152`, a byte at `+156` that\n`HideIt` clears and a byte at `+157` that is 1 for hiding the pointer while\ndrawing. The dragger in use is at `data+0x62638`. A screen is a device that\n`TestDeviceAttribute` passes with 13.",
  "routines": [
   {
    "name": "TBaseDragger::TBaseDragger",
    "entry": 149832,
    "text": "Sets up a dragger with the Window Manager's color port, a new region, no mask,\nno buffers and the pointer hidden while drawing, and makes it the dragger in use\n(`0x024958` to `0x024994`)."
   },
   {
    "name": "TBaseDragger::~TBaseDragger",
    "entry": 149976,
    "text": "Clears the dragger in use, disposes of the region at `+136` and frees the\nbuffers (`0x0249F4` to `0x024A10`), and frees the object when the flag is above\n0. The clip saved in the region is not set back into the port."
   },
   {
    "name": "TBaseDragger::SetImage",
    "entry": 150132,
    "text": "Sets the image to drag. The arguments are an image, the place of its top left\nas v and then h, and a mask or 0 (`0x024A84` to `0x024A94`). It copies\nthe two pixel map records (`0x024AA8` to `0x024BA0`), records the image's size\nfrom its bounds (`0x024B10` to `0x024B2C`) and the place as the pointer's last\n(`0x024BB0` to `0x024BB8`). In the Window Manager's port it saves the clip into\nthe region at `+136` and clips to the whole desktop (`GetGrayRgn`, `0x024BC4`\nto `0x024BE4`), then makes the buffers (`MakeBufs`, `0x024BEC` to `0x024C00`),\nand sets the port back."
   },
   {
    "name": "TBaseDragger::UnmakeBufs",
    "entry": 150644,
    "text": "Disposes of both worlds of each screen's record and the record, down the list, which ends empty (`0x024C90` to `0x024CE4`)."
   },
   {
    "name": "TBaseDragger::MakeBufs",
    "entry": 150832,
    "text": "Sets `+0` and `+16` to the image's size at the origin and `+8` to it at the\nplace given (`0x024D58` to `0x024DAC`). For each screen it adds a record to the\nend of the list (`0x024DF4` to `0x024E4C`) and makes the two worlds at the\nscreen's depth and with its colors, each locked and with its color table's\nseed set to the screen's (`0x024E50` to `0x024F6C`). A failed allocation of a record gives -108 (`0x024E08`). After a failure the routine frees the buffers and empties the list (`0x024F94` to `0x024FA8`), and the dragger draws an outline\ninstead."
   },
   {
    "name": "TBaseDragger::HideIt",
    "entry": 151536,
    "text": "Removes the image from the screen. With no buffers it draws the outline, a frame\nof `+8` in QuickDraw's gray pattern, `+178` of the QuickDraw globals at toc\n-30444 (named from their offsets, an inference), and the mode 10, a pattern\nexclusive-or, in the Window Manager's port (`0x025024` to `0x025058`),\nso a second frame in the same place erases it. With buffers it copies what was under the\nimage back onto each screen that the rectangle crosses, from the first world\n(`0x025090` to `0x025130`). It clears `+156` (`0x025158` to `0x02515C`)."
   },
   {
    "name": "TBaseDragger::ShowIt",
    "entry": 151988,
    "text": "Puts the image on the screen. With no buffers it draws the outline as `HideIt`\ndoes (`0x0251E8` to `0x02521C`). With buffers it copies the second world, the\nimage over what is under it, onto each screen that the rectangle crosses\n(`0x025254` to `0x0252F4`)."
   },
   {
    "name": "TBaseDragger::AddData",
    "entry": 152432,
    "text": "Draws the image into each screen's second world over what is there, through the\nmask with `CopyDeepMask` when there is one (`0x0253C8` to `0x0253EC`) and in the\ntransparent mode, 36, otherwise (`0x0253F8` to `0x025414`)."
   },
   {
    "name": "TBaseDragger::ReInit",
    "entry": 152700,
    "text": "Moves the screen rectangle by the h and v given (`0x0254C8` to `0x0254DC`) and\ncopies what the screen has under it into both worlds of each record\n(`0x025540` to `0x0255C0`). The routine cuts a rectangle above the screen's top at 0 (`0x02550C` to `0x025538`), and leaves one past the left edge as it is."
   },
   {
    "name": "TBaseDragger::MoveIt",
    "entry": 153152,
    "text": "Moves the image to a new pointer place, h then v, unless the place is the last\none (`0x025664` to `0x025678`). It removes the image, moves the rectangle by\nthe change, saves what is under it, draws the image over that and shows it\n(`0x0256A8` to `0x0256D4`), and records the place (`0x0256D8` to `0x0256DC`),\nin the Window Manager's port with the pointer hidden."
   },
   {
    "name": "TBaseDragger::OccludeDrag",
    "entry": 153416,
    "text": "Removes the image from the screen and returns 1 when its rectangle crosses the\nrectangle given, so the window under it can draw there (`0x025758` to\n`0x0257A8`), and returns 0 otherwise."
   },
   {
    "name": "TBaseDragger::DeOccludeDrag",
    "entry": 153600,
    "text": "Puts the image back after `OccludeDrag`, over what the screen has now. It saves\nwhat is under the rectangle again, draws the image over that and shows it\n(`0x025840` to `0x02585C`)."
   }
  ]
 },
 "TListBox": {
  "opening": "A List Manager list, the base of the game's lists (abilities, inventory, the\nto-do list, the journal, portraits, archetypes and the rest). The object has\nits vtable at `+0` and the list's handle at `+4`. The offsets of the list's\nrecord are the List Manager's, with the view rectangle at `+0`, the port at `+8`,\nthe cell size at `+16`, the visible cells at `+20`, the vertical and horizontal\nscroll bars at `+28` and `+32`, the selection flags at `+36`, the time of the\nlast click at `+40`, the reference at `+60`, the user handle at `+68`, the\ncells' bounds at `+72` and the cells' data at `+80`. A cell is a point, the row\nin v and the column in h. A cell's index is its row times the number of\ncolumns plus its column, the number of columns being the right of the bounds.\n\nThe vtable's slots are 8 `GetSelection`, 12 `SetSelection`, 16 `Hide`, 20\n`Show`, 24 `MoveList`, 28 `SetNumCols`, 32 `SetNumRows`, 36 `AdjustForGrow`, 40\n`Key`, 44 `ResetMouseUp`, 48 `Click`, 52 `Update`, 56 `Size`, 60 the destructor,\n64 `LDEFDraw`, 68 `LDEFHilite`, 72 `GetCount`, 76 `GetData`, 80 `DrawIntoPort`\nand 84 `RevealCell`.",
  "routines": [
   {
    "name": "TListBox::Size",
    "entry": 192660,
    "text": "Sets the list's view to the width and height given (`LSize`, `0x02F0A8` to `0x02F0C4`)."
   },
   {
    "name": "TListBox::Update",
    "entry": 194900,
    "text": "Draws the list within the region given (`LUpdate`, `0x02F960` to `0x02F974`)."
   },
   {
    "name": "TListBox::GetCount",
    "entry": 199524,
    "text": "Returns the bottom of the cells' bounds, the number of rows (`0x030B64` to `0x030B6C`)."
   },
   {
    "name": "TListBox::GetData",
    "entry": 199580,
    "text": "Returns the handle to the cells' data (`0x030B9C` to `0x030BA4`)."
   },
   {
    "name": "TListBox::TListBox",
    "entry": 445272,
    "text": "Makes the list with the List Manager, from the view, the bounds, the cell size,\nthe window and the four flags given, with the list definition 128 (`LNew`,\n`0x06CBC8` to `0x06CBF8`), whose result goes untested, so the routine reads a list it could not make through address 0 (`0x06CC0C`). It puts a routine descriptor in the list's\nreference, made once and stored at `data+0x6DA84` (`0x06CB88` to `0x06CBC4`,\n`0x06CBFC` to `0x06CC10`), and the object in its user handle (`0x06CC14` to\n`0x06CC1C`), for the list definition to reach the object (an inference). The routine sets the selection flags to `0x80`, one cell at a time (`0x06CBFC`, `0x06CC28`)."
   },
   {
    "name": "TListBox::~TListBox",
    "entry": 445584,
    "text": "Disposes of the list when there is one (`LDispose`, `0x06CCB4` to `0x06CCD0`), and frees the object when the flag is above 0."
   },
   {
    "name": "TListBox::Hide",
    "entry": 445736,
    "text": "Moves the list 16,384 pixels to the right, out of the window, with its scroll\nbars, and marks its old place to be redrawn (`0x06CD50` to `0x06CE18`). The routine leaves a list already that far right alone (`0x06CD3C` to `0x06CD4C`)."
   },
   {
    "name": "TListBox::Show",
    "entry": 446040,
    "text": "Moves a hidden list 16,384 pixels back to the left with its scroll bars and marks its place for redrawing (`0x06CE80` to `0x06CF48`). The routine leaves a list left of 16,384 alone (`0x06CE6C` to `0x06CE7C`)."
   },
   {
    "name": "TListBox::MoveList",
    "entry": 446344,
    "text": "Moves the list's view, with its scroll bars, so its top left lands at the h and v given (`0x06CFB4` to `0x06D0A0`). The step is h less the present left taken\nmodulo 16,384 (`0x06CFD0` to `0x06CFDC`), added to the whole left (`0x06CFF0`),\nso a list hidden 16,384 to the right stays hidden at its new place. The scroll\nbars move by the same step (`0x06D040`, `0x06D098`). The routine marks only the old place for redrawing (`0x06CFAC`)."
   },
   {
    "name": "TListBox::AdjustForGrow",
    "entry": 446696,
    "text": "Sizes a scroll bar to the view. The routine gives a vertical bar the view's height less 15\n(`0x06D138` to `0x06D190`) when there is no horizontal one. With no vertical bar,\nit gives a horizontal one the view's width less 15 (`0x06D1B0` to `0x06D208`).\nWith both, it sizes neither (`0x06D110` to `0x06D120`)."
   },
   {
    "name": "TListBox::SetNumCols",
    "entry": 447060,
    "text": "Gives the list the number of columns given, when it has a different number. It\ndeletes every column, adds the number given and deletes every row (`0x06D2A0` to\n`0x06D2D4`), so the list ends with no rows."
   },
   {
    "name": "TListBox::SetNumRows",
    "entry": 447268,
    "text": "Compares the number given with the list's number of rows (`0x06D344` to\n`0x06D36C`) and, when they differ, does what `SetNumCols` does. It deletes every\ncolumn, adds the number given as columns and deletes every row (`0x06D370` to\n`0x06D3A4`). No routine that the facts show calls a list through slots 28 or\n32, so neither routine runs in the game (an inference)."
   },
   {
    "name": "TListBox::LDEFDraw",
    "entry": 447476,
    "text": "Draws a cell's text. It erases the cell's rectangle (`0x06D424` to `0x06D428`),\nmoves the pen 3 pixels in from the left, with the text centered by height\n(`0x06D430` to `0x06D464`), and draws the cell's bytes from the list's data\n(`DrawText`, `0x06D46C` to `0x06D488`). A selected cell is then inverted in the\nhighlight color (`0x06D490` to `0x06D4B4`)."
   },
   {
    "name": "TListBox::LDEFHilite",
    "entry": 447752,
    "text": "Draws the cell again through slot 64, `LDEFDraw`, with the same arguments, rather than inverting it (`0x06D518` to `0x06D54C`)."
   },
   {
    "name": "TListBox::GetSelection",
    "entry": 448152,
    "text": "Returns the index of the first selected cell (`LGetSelect`, `0x06D6AC` to\n`0x06D6F4`), or -1 when none is (`0x06D6FC`)."
   },
   {
    "name": "TListBox::SetSelection",
    "entry": 448320,
    "text": "Selects the cell with the index given, alone. It deselects every other selected\ncell (`0x06D78C` to `0x06D834`), selects the cell (`0x06D840` to `0x06D88C`) and\nscrolls it into view through slot 84 (`0x06D894` to `0x06D8A4`). A negative\nindex deselects all and selects nothing (`0x06D838` to `0x06D83C`)."
   },
   {
    "name": "TListBox::RevealCell",
    "entry": 448752,
    "text": "Scrolls the list so the cell given shows (`LScroll`, `0x06D9F8` to `0x06DA04`).\nA cell below the visible rows scrolls it to the last visible row (`0x06D930` to\n`0x06D944`). A cell above them scrolls one row further, to the second visible\nrow (`0x06D964` to `0x06D978`). The routine treats the columns the same way\n(`0x06D97C` to `0x06D9E4`)."
   },
   {
    "name": "TListBox::Key",
    "entry": 449112,
    "text": "Moves the selection for a key, with the modifiers in the third argument. With a\ncell selected (`0x06DA88` to `0x06DAA8`), the arrow keys, 28 to 31, move it by one\ncell (`0x06DAAC` to `0x06DB18`). A new row or column below 0 becomes 0\n(`0x06DB1C` to `0x06DB40`). Past the end it stops at the number of columns or\nrows, one past the last cell (`0x06DB44` to `0x06DB94`). The routine selects a changed cell in place of the old one (`0x06DBC0` to `0x06DBE8`), and then calls slot 84 with the old cell, not the new one (`0x06DBF0` to `0x06DC00`). So\nthe down arrow on the last row, or the right arrow in the last column, clears\nthe old cell and selects one outside the list, which leaves nothing selected\n(an inference that the List Manager ignores such a cell), and the arrows then\ndo nothing until a click selects a cell, since they need one (`0x06DAA8`).\nAny other key, or an arrow that leaves the cell where it was, goes on to the\ncodes 272 to 276 (`0x06DC0C` to `0x06DC60`). 272 goes to the first row, 273 up\na page of the visible rows less 1, 275 to the last row, 276 down a page, and\n274 does nothing. Each scrolls or reveals the row (`0x06DC64` to `0x06DE50`) and\nmoves the selection there only with the Shift key, the bit `0x200` of the\nmodifiers (`0x06DCC8`, `0x06DD84`, `0x06DDE8`, `0x06DE58`), in the column at the\nview's left, not the selected cell's (`0x06DC1C` to `0x06DC28`). The page down\nstops at the number of rows, not at the last row (`0x06DD38` to `0x06DD5C`), so\non a list shorter than the view it loses the selection as the arrows do."
   },
   {
    "name": "TListBox::Click",
    "entry": 450268,
    "text": "Handles a click at a point. A click on a scroll bar's thumb drags it with the\nlist following, row by row or column by column (`0x06DF44` to `0x06E0CC`), and\nreturns 0. Elsewhere it returns what `LClick` returns (`0x06E0D8` to\n`0x06E0E4`). While the button is down, the value follows the pointer's place\nalong the bar less 24 (the arrow and half the thumb), limited to 0 up to the\nbar's length less 48 (`0x06DFE8` to `0x06E050`). The value is the place times\nthe range over that length, rounded to the nearest (`0x06E054` to `0x06E078`),\nand the list scrolls by the change (`0x06E08C` to `0x06E0B8`). A bar of 48\npixels or less divides by 0 or a negative number. The rectangle that\n`InsetRect` widens by 16 is not used after (`0x06DF78`)."
   },
   {
    "name": "TListBox::ChangeScrollBars",
    "entry": 450860,
    "text": "Replaces each of the list's scroll bars with a new control of the definition\ngiven, with the old one's rectangle, title, visibility, value, minimum, maximum,\nreference and action routine (`0x06E178` to `0x06E228`), and disposes of the old\none (`0x06E254` to `0x06E258`)."
   },
   {
    "name": "TListBox::ResetMouseUp",
    "entry": 451252,
    "text": "Sets the list's time of the last click to the present tick count (`TickCount`, `0x06E2C4` to `0x06E2D8`)."
   },
   {
    "name": "TListBox::PointToCell",
    "entry": 451352,
    "text": "Returns the cell at a point of the window, or (-1, -1) for a point outside the\nview (`0x06E338` to `0x06E368`) or past the last row or column (`0x06E3E4` to\n`0x06E420`). The cell is the point's distance from the view's top left over the\ncell size, plus the first visible cell (`0x06E36C` to `0x06E3E0`)."
   },
   {
    "name": "TListBox::DrawIntoPort",
    "entry": 451700,
    "text": "Draws the list into the port given. For the port the list is in, it calls slot 52,\n`Update`, with the port's visible region (`0x06E498` to `0x06E4B0`). For another\nport it points the list and both scroll bars at that port (`0x06E4BC` to\n`0x06E4FC`), draws the bars (`0x06E500` to `0x06E520`) and erases the view\n(`0x06E528` to `0x06E544`). Each visible cell within the bounds that crosses the\nview is then drawn through slot 64 with its rectangle, data and selection,\nclipped to its part of the view (`0x06E5C0` to `0x06E6A4`), which replaces the\ncaller's clip rather than narrowing it (`0x06E650`). The routine draws in the\ncurrent port, setting none. It sets the clip, the list's port and the bars' owner back after (`0x06E6A8` to `0x06E6E8`)."
   }
  ]
 },
 "MemRange": {
  "opening": "",
  "routines": [
   {
    "name": "MemRange::Test",
    "entry": 636956,
    "text": "Compares the checksum of a block of memory with the one stored beside it. It\nreckons the checksum of the long at `+4` bytes from the address at `+0`\n(`CalcChecksum`, `0x09B830` to `0x09B838`) and calls `DebugStr` with \"Failed Sanity Checksum\"\nwhen the result differs from the long at `+8` (`0x09B83C` to `0x09B84C`).\nThe checksum routine always returns 0, so the test never reads the memory and\nfails exactly when the long at `+8` is other than 0. The one caller is\n`TSanityChunk::CheckSanity`."
   }
  ]
 },
 "SCombatAIHeader": {
  "opening": "The first 32 bytes of a compiled combat AI. They have the name as a length byte\nand up to 23 characters, and 8 bytes at 24 to 31 that are 0. The routine writes\nnothing between the end of the name and byte 23, so in the archive's compiled AIs\nthose bytes have stray values, such as `d2 00 00 43 34 00 7f 88 65` after\n\"Attack Nearest\". The lines (`SCombatAIEntry`) follow.",
  "routines": [
   {
    "name": "SCombatAIHeader::CompileHeader",
    "entry": 713308,
    "text": "Reads the first line of a combat AI source file, `NAME \"<name>\"`, into the\nobject for `CompileAIFile`, and returns 0, or an error message. It first sets the\nname's length, byte 0, and the 8 bytes at `+24` to 0 (`0x0AE274` to `0x0AE2A4`).\nThe first token has to be `NAME` and the second `\"` (`GetToken`, `strcmp`,\n`0x0AE2A8` to `0x0AE308`). An empty first token returns \"Empty line\", another word\n\"Expecting Script NAME\", and anything but the quote \"Expecting double-quoted\nstring (\"Script Name\")\" (`0x0AE2C0`, `0x0AE2E0`, `0x0AE30C`). The name is the\ntext after the quote up to the next `\"`, a zero byte or 23 characters, a Pascal\nstring from byte 1 (`0x0AE314` to `0x0AE360`), so the routine cuts a longer name\nshort and accepts a name with no closing quote. The loop never tests for a\nline's end, and the lines that `CompileAIFile` reads end with their line-end\ncharacter, so a name with no closing quote ends with that character too. The token buffer at\n`56(1)` has 64 bytes below the saved registers at `120(1)`, and `GetToken` has no\nbound, so a first or second token of 64 or more characters overwrites the\ncaller's r30, one of 68 or more r31 as well, and one of 80 or more the return address at `136(1)`\n(`0x0AE25C` to `0x0AE278`). The file is one the player imports, `CompileAIFile`'s one\ncaller being `TEditUserBehavior::DialogItemRoutine`, whose dialog reads \"Import AI\nsource file\"."
   }
  ]
 },
 "TAIList": {
  "opening": "The list of the user combat AIs in `TEditUserBehavior`'s dialog, a `TListBox`\nwhose row n is combat AI 176 plus n.",
  "routines": [
   {
    "name": "TAIList::TAIList",
    "entry": 725456,
    "text": "Makes the list as a `TListBox` from the view, the bounds, the cell size and the\nwindow given, with the flags 1, 0, 0 and 1, which `TListBox::TListBox` passes to\n`LNew` in that order, so the list draws, has no grow box and has a vertical scroll\nbar alone (`0x0B11E0` to `0x0B1218`). It sets the vtable to `TAIList`'s and replaces the scroll bar with a\ncontrol of definition 16,016, `'CDEF'` 1001 with variation 0, the game's scroll bar\n(`TListBox::ChangeScrollBars`, `0x0B1220` to `0x0B1230`). It returns the object."
   },
   {
    "name": "TAIList::LDEFDraw",
    "entry": 725648,
    "text": "Draws a cell, row n of the list, as the name of combat AI 176 plus n\n(`GetCombatAIName`, `0x0B12A8` to `0x0B12B8`), so row 0 is \"User Combat AI #1\"\nwhen no resource names it. It fills the cell with white, `+194` of the QuickDraw globals at toc -30444 (named from their offsets, an inference) (`FillRect`, `0x0B12C8` to\n`0x0B12D4`), and moves the pen 3 pixels in from the left, with the text centered\nby height (`GetFontInfo`, `MoveTo`, `0x0B12BC` to `0x0B1310`). When row n's byte\nin the table at `data+0x77BC4` is other than 0, it first draws \" -\" in red\n(`ForeColor` 205, `DrawString`, `0x0B1318` to `0x0B133C`) and sets the color back\nto black (33, `0x0B1344` to `0x0B1348`). The selected row's byte flips between 0\nand 1 in `TEditUserBehavior::DialogItemRoutine`, and `PerformAI` reads it for the\nAIs 176 to 206. Then it\ndraws the name (`0x0B1350` to `0x0B1354`) and inverts a selected cell in the\nhighlight color (`LMSetHiliteMode`, `InvertRect`, `0x0B135C` to `0x0B1380`)."
   },
   {
    "name": "TAIList::~TAIList",
    "entry": 726776,
    "text": "Sets the vtable to `TAIList`'s and runs `TListBox::~TListBox`, which disposes of\nthe list (`0x0B1714` to `0x0B1724`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TArchetypeList": {
  "opening": "The list of archetypes in `TCreatePlayerDialog`'s dialog, a `TListBox`.",
  "routines": [
   {
    "name": "TArchetypeList::TArchetypeList",
    "entry": 657688,
    "text": "Makes the list as a `TListBox` from the view, the bounds, the cell size and the\nwindow given, with the flags 1, 0, 0 and 1, which `TListBox::TListBox` passes to\n`LNew` in that order, so the list draws, has no grow box and has a vertical scroll\nbar alone (`0x0A0928` to `0x0A0960`). It sets the vtable to `TArchetypeList`'s and replaces the scroll bar with a\ncontrol of definition 16,016, `'CDEF'` 1001 with variation 0, the game's scroll bar\n(`TListBox::ChangeScrollBars`, `0x0A0968` to `0x0A0978`). It returns the object."
   },
   {
    "name": "TArchetypeList::LDEFDraw",
    "entry": 657888,
    "text": "Draws a cell as `TListBox::LDEFDraw` does, on a white background, which it sets\nto white, `+194` of the QuickDraw globals at toc -30444 (named from their offsets, an inference) for the call (`BackPat`, `0x0A09E4` to `0x0A0A0C`, `0x0A0A2C`). After it the\nbackground is the pixel pattern of tile 420 (`SetTilePat`, `BackPixPat`,\n`0x0A0A34` to `0x0A0A40`), the dialog's background."
   },
   {
    "name": "TArchetypeList::~TArchetypeList",
    "entry": 671148,
    "text": "Sets the vtable to `TArchetypeList`'s and runs `TListBox::~TListBox`, which\ndisposes of the list (`0x0A3DD4` to `0x0A3DD8`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TCheckButtonCDEF": {
  "opening": "The control definition object of the game's check boxes, `'CDEF'` 1000 with variation 1\nin the low 3 bits, a `TCDEF` whose drawing is `DrawCheck` with tile 427. `TRadioButtonCDEF` is the\nsame code with tile 428.",
  "routines": [
   {
    "name": "TCheckButtonCDEF::TCheckButtonCDEF",
    "entry": 681632,
    "text": "Makes a `TCDEF` for the control (`0x0A66C4`) and sets the vtable to `TCheckButtonCDEF`'s (`0x0A66CC` to\n`0x0A66D4`)."
   },
   {
    "name": "TCheckButtonCDEF::Create",
    "entry": 681772,
    "text": "Allocates 8 bytes and makes a check box in them for the control given (`0x0A6740` to `0x0A6764`), and\nreturns it, or 0 when the allocation fails."
   },
   {
    "name": "TCheckButtonCDEF::DrawAPart",
    "entry": 681920,
    "text": "Draws the control with `DrawCheck`, the control's rectangle, its title, `+40` of\nthe record, a state and tile 427 (`0x0A689C` to `0x0A68B8`). The state is 1 when the\nhighlight, byte 17 of the record, is 10 or 1 (`0x0A67DC` to `0x0A67F8`), 2 for a\nhighlight of 255, inactive (`0x0A6800` to `0x0A6828`), 3 for a value, the short at `+18`,\nother than 0 (`0x0A6830` to `0x0A6844`), and 0 otherwise. So state 1 shows over a check, and an\ninactive box never shows its check. With bit 3 of the variation code set,\nApple's `useWFont` (an inference from the number), it first sets the port's font,\nsize and style to the window's (`TextFont`, `TextSize`, `TextFace`, `0x0A6854` to `0x0A6894`),\nwhich changes nothing on the screen, since `DrawCheck` sets text style 0 for the\nlabel and sets the port's back after it."
   },
   {
    "name": "TCheckButtonCDEF::~TCheckButtonCDEF",
    "entry": 691072,
    "text": "Sets the vtable to `TCheckButtonCDEF`'s and runs `TCDEF::~TCDEF` (`0x0A8B9C` to `0x0A8BAC`), and frees the\nobject when the flag is above 0."
   },
   {
    "name": "TCheckButtonCDEF::GetPreferedCTable",
    "entry": 691220,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A8C14` to `0x0A8C18`)."
   }
  ]
 },
 "TRadioButtonCDEF": {
  "opening": "The control definition object of the game's radio buttons, `'CDEF'` 1000 with variation 2\nin the low 3 bits, a `TCDEF` whose drawing is `DrawCheck` with tile 428. `TCheckButtonCDEF` is the\nsame code with tile 427.",
  "routines": [
   {
    "name": "TRadioButtonCDEF::TRadioButtonCDEF",
    "entry": 682292,
    "text": "Makes a `TCDEF` for the control (`0x0A6958`) and sets the vtable to `TRadioButtonCDEF`'s (`0x0A6960` to\n`0x0A6968`)."
   },
   {
    "name": "TRadioButtonCDEF::Create",
    "entry": 682432,
    "text": "Allocates 8 bytes and makes a radio button in them for the control given (`0x0A69D4` to `0x0A69F8`), and\nreturns it, or 0 when the allocation fails."
   },
   {
    "name": "TRadioButtonCDEF::DrawAPart",
    "entry": 682580,
    "text": "Draws the control with `DrawCheck`, the control's rectangle, its title, `+40` of\nthe record, a state and tile 428 (`0x0A6B30` to `0x0A6B4C`). The state is 1 when the\nhighlight, byte 17 of the record, is 10 or 1 (`0x0A6A70` to `0x0A6A8C`), 2 for a\nhighlight of 255, inactive (`0x0A6A94` to `0x0A6ABC`), 3 for a value, the short at `+18`,\nother than 0 (`0x0A6AC4` to `0x0A6AD8`), and 0 otherwise. So state 1 shows over a check, and an\ninactive box never shows its check. With bit 3 of the variation code set,\nApple's `useWFont` (an inference from the number), it first sets the port's font,\nsize and style to the window's (`TextFont`, `TextSize`, `TextFace`, `0x0A6AE8` to `0x0A6B28`),\nwhich changes nothing on the screen, since `DrawCheck` sets text style 0 for the\nlabel and sets the port's back after it."
   },
   {
    "name": "TRadioButtonCDEF::~TRadioButtonCDEF",
    "entry": 690852,
    "text": "Sets the vtable to `TRadioButtonCDEF`'s and runs `TCDEF::~TCDEF` (`0x0A8AC0` to `0x0A8AD0`), and frees the\nobject when the flag is above 0."
   },
   {
    "name": "TRadioButtonCDEF::GetPreferedCTable",
    "entry": 691000,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A8B38` to `0x0A8B3C`)."
   }
  ]
 },
 "TPortraitList": {
  "opening": "The list of portraits in `TCreatePlayerDialog`'s dialog, a `TListBox` of three\nrows and two columns, whose bounds the dialog's constructor builds. Its cells\nshow resources `0x88EF` to `0x88F1` and `0x88F5` to `0x88F7`, and of the twelve from\n`0x88EF` to `0x88FA` the other six are never drawn.",
  "routines": [
   {
    "name": "TPortraitList::TPortraitList",
    "entry": 656944,
    "text": "Makes the list as a `TListBox` from the view, the bounds, the cell size and the\nwindow given, with the flags 1, 0, 0 and 1, which `TListBox::TListBox` passes to\n`LNew` in that order, so the list draws, has no grow box and has a vertical scroll\nbar alone (`0x0A0640` to `0x0A0678`). It sets the vtable to `TPortraitList`'s and\nreplaces the scroll bar with a control of definition 16,016, `'CDEF'` 1001 with\nvariation 0, the game's scroll bar (`TListBox::ChangeScrollBars`, `0x0A0680` to\n`0x0A0690`). It returns the object."
   },
   {
    "name": "TPortraitList::LDEFDraw",
    "entry": 657144,
    "text": "Draws cell (h, v) as the portrait in resource `0x88EF` plus 6h plus v, 64 by 64\npixels at the cell's top left (`SetRect`, `OffsetRect`, `0x0A0794` to `0x0A07C0`,\n`0x0A07C8` to `0x0A07E8`). It reads the resource from the archive at\n`data+0x181EC` (`TCachedSegFiles::GetSegment`) and unpacks it into the buffer at\n`data+0x76356` (`LZUnpack`, `0x0A07F8` to `0x0A0800`), the pixels of a copy of the pixel map record at toc -5276 with the\nbounds (0, 0, 64, 64) and rows of 64 bytes (`0x0A0700` to `0x0A07B4`,\n`0x0A0808` to `0x0A0810`). It erases the cell's square and copies the picture\ninto the current port with white left out (the transfer mode 36, `CopyBits`, `0x0A080C` to `0x0A0864`). Before the copy it sets the\nbackground color to the one it reads, twice, which changes nothing (`GetBackColor`,\n`RGBBackColor`, `0x0A081C` to `0x0A0838`). A missing resource leaves the square\nerased (`0x0A0870` to `0x0A0874`). Neither this routine nor `LDEFHilite` marks a\nselected cell."
   },
   {
    "name": "TPortraitList::LDEFHilite",
    "entry": 657620,
    "text": "Does nothing (`0x0A08D4`), so the List Manager's highlighting of a cell changes\nnothing in the list."
   },
   {
    "name": "TPortraitList::~TPortraitList",
    "entry": 660228,
    "text": "Sets the vtable to `TPortraitList`'s and runs `TListBox::~TListBox`, which\ndisposes of the list (`0x0A1320` to `0x0A1330`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TWIcon": {
  "opening": "A picture in a scripted window, a widget of 32 by 32 pixels that shows one tile.\nThe window's routine that adds an icon, `TScriptedWindow::DisplayAddIcon`, makes\nit. Its tile number is the short at `+36`,\nafter the widget's fields.",
  "routines": [
   {
    "name": "TWIcon::TWIcon",
    "entry": 568724,
    "text": "Makes a widget of the window given at the h and v given, 32 by 32 pixels\n(`0x08ADA8` to `0x08ADD0`), and sets the vtable to `TWIcon`'s (`0x08ADD4` to\n`0x08ADDC`). Its tile is minus n for a number n below 0 (`0x08ADE4` to\n`0x08ADE8`), and otherwise the first tile of prop type n's low 10 bits, from the\ntable of shorts at `data+0x60568`, plus n shifted right 10 (`0x08ADF0` to\n`0x08AE08`), so a script gives a tile directly as its negative, or a type and a\nframe as type plus 1,024 times the frame."
   },
   {
    "name": "TWIcon::TWIcon",
    "entry": 568928,
    "text": "Makes the widget from a stream, the reverse of `Marshal`, and reads its tile\nwith the format `\"h\"` (`TStream::ReadData`, slot 44, `0x08AE7C` to `0x08AEA0`)."
   },
   {
    "name": "TWIcon::Marshal",
    "entry": 569072,
    "text": "Writes the widget to a stream, first its kind, `'wIcn'`, with the format `\"l\"`\n(`TStream::WriteData`, slot 40, `0x08AEF8` to `0x08AF24`), then the widget's fields\n(`0x08AF2C` to `0x08AF34`), then its tile with `\"h\"` (`0x08AF3C` to\n`0x08AF50`)."
   },
   {
    "name": "TWIcon::Draw",
    "entry": 569248,
    "text": "Draws the tile into the widget's rectangle in the port given, a copy of the pixel map record at toc -5276\nwith the address of the tile's 1,024 bytes of pixels, from the pointer at\n`data+0x60564`, with white left out (the transfer mode 36, `CopyBits`, `0x08AFAC` to `0x08B05C`)."
   },
   {
    "name": "TWIcon::~TWIcon",
    "entry": 588660,
    "text": "Sets the vtable to `TWIcon`'s and then to the widget's (`0x08FB90` to\n`0x08FBA4`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TWListList": {
  "opening": "The List Manager list inside a list widget of a scripted window, a `TListBox`\nthat `TWList::TWList` makes. Each cell's data is 4 bytes and then its text.",
  "routines": [
   {
    "name": "TWListList::TWListList",
    "entry": 581480,
    "text": "Makes the list as a `TListBox` with every argument given, the four flags\nincluded, and leaves the scroll bars as `LNew` made them (`0x08DF7C` to `0x08DFBC`). It sets the vtable\nto `TWListList`'s (`0x08DFC4` to `0x08DFCC`) and returns the object."
   },
   {
    "name": "TWListList::LDEFDraw",
    "entry": 581680,
    "text": "Draws a cell's text. It erases the cell's rectangle (`EraseRect`, `0x08E060` to\n`0x08E064`), moves the pen 3 pixels in from the left, with the text centered by\nheight (`GetFontInfo`, `MoveTo`, `0x08E048` to `0x08E058`, `0x08E06C` to\n`0x08E0A0`), and draws the cell's data from its fifth byte, its length less 4\n(`AADrawText`, `0x08E0A8` to `0x08E0CC`), so the first 4 bytes stay unshown. It\nthen inverts a selected cell in the highlight color (`LMSetHiliteMode`,\n`InvertRect`, `0x08E0D4` to `0x08E0F8`)."
   },
   {
    "name": "TWListList::LDEFHilite",
    "entry": 581968,
    "text": "Inverts the cell's rectangle in the highlight color (`LMSetHiliteMode`,\n`InvertRect`, `0x08E160` to `0x08E178`), where `TListBox::LDEFHilite` draws the\ncell again."
   },
   {
    "name": "TWListList::~TWListList",
    "entry": 588108,
    "text": "Sets the vtable to `TWListList`'s and runs `TListBox::~TListBox`, which disposes\nof the list (`0x08F968` to `0x08F978`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TProgBarCDEF": {
  "opening": "The control definition object of the game's progress bars, `'CDEF'` 1001 with\nvariation 1 in the low 3 bits, a `TCDEF`. Its art is tile 421, the thumb in the\ntop half and the track in the bottom half.",
  "routines": [
   {
    "name": "TProgBarCDEF::TProgBarCDEF",
    "entry": 684568,
    "text": "Makes a `TCDEF` for the control (`0x0A723C`) and sets the vtable to\n`TProgBarCDEF`'s (`0x0A7244` to `0x0A724C`)."
   },
   {
    "name": "TProgBarCDEF::Create",
    "entry": 684704,
    "text": "Allocates 8 bytes and makes a progress bar in them for the control given\n(`0x0A72B4` to `0x0A72D8`), and returns it, or 0 when the allocation fails."
   },
   {
    "name": "TProgBarCDEF::CalcThumb",
    "entry": 684848,
    "text": "Returns the left edge of the thumb, 32 pixels wide, the control's left plus the\nwidth less 32 times the value less the minimum, over the maximum less the minimum\n(`0x0A7334` to `0x0A73B8`). With less than 16 pixels to move in, or a maximum not\nabove the minimum, it returns the control's left (`0x0A737C` to `0x0A738C`,\n`0x0A73C0`). The value goes untested against the two ends, so a value past the\nmaximum puts the thumb past the bar's right end."
   },
   {
    "name": "TProgBarCDEF::DrawAPart",
    "entry": 685056,
    "text": "Draws the bar. The track is the bottom half of tile 421 across the control's\nrectangle (`ExpandHorizontally`, `0x0A741C` to `0x0A7454`). With a minimum below\nthe maximum (`0x0A745C` to `0x0A7468`), it then copies the top left 32 by 16 pixels\nof tile 421 onto the bar at the thumb's place, in the source copy mode\n(`SetRect`, `CalcThumb`, `OffsetRect`, `CopyBits`, `0x0A746C` to `0x0A7570`), and\ndraws a number in text style 1, centered across the thumb, with half the style's\nascent below its middle (`SetText`, `StringWidth`, `MoveTo`, `AADrawText`,\n`0x0A7578` to `0x0A7610`). The number is the control's reference, the long at\n`+36` of the record, not its value (`NumToString`, `0x0A7584` to `0x0A7594`), so\nthe figure on the thumb and the thumb's place come from two different fields. A bar whose\nminimum is not below its maximum shows the track alone."
   },
   {
    "name": "TProgBarCDEF::~TProgBarCDEF",
    "entry": 690216,
    "text": "Sets the vtable to `TProgBarCDEF`'s and runs `TCDEF::~TCDEF` (`0x0A8844` to\n`0x0A8854`), and frees the object when the flag is above 0."
   },
   {
    "name": "TProgBarCDEF::GetPreferedCTable",
    "entry": 690360,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A88B8` to\n`0x0A88BC`)."
   }
  ]
 },
 "TPixCacheBase": {
  "opening": "The cache of the 256 interface pictures, unpacked into blocks of a `TCache`, the\none at `+4`. For picture n it has the height and the width as shorts at `+8` and\n`+10` plus 4n, a count of users as a short at `+1032` plus 2n, and the address of\nthe unpacked pixels at `+1544` plus 4n, which the `TCache` clears when it frees\nthe block. Slot 8 gives a picture's packed data and slot 12 lets it go, and the\none subclass, `TPixCacheFromCachedSegFiles`, reads them from resources `0x8F00`\nup.",
  "routines": [
   {
    "name": "TPixCacheBase::TPixCacheBase",
    "entry": 475956,
    "text": "Sets the vtable and the cache given at `+4` (`0x07433C` to `0x074344`), and\nclears the address and the count of users of each of the 256 pictures, leaving the\nsizes as they are (`0x07434C` to `0x074380`)."
   },
   {
    "name": "TPixCacheBase::NewPix",
    "entry": 476096,
    "text": "Fills the pixel map given for picture n and counts one more user of it. The map\nstarts as a copy of the pixel map record at toc -5276 (`0x0743C8` to `0x074450`).\nA picture already unpacked moves to the head of the cache's ring (`TCache::Touch`,\n`0x074460` to `0x074474`), and the map receives its bounds (0, 0, width, height), rows of the width rounded up to 4 bytes, with the pixel map bit `0x8000`, and its pixels (`0x07447C` to `0x0744FC`). Otherwise\nthe routine reads the packed data through slot 8, whose first two shorts are the\nwidth and the height (`0x074504` to `0x07452C`), stores the two sizes\n(`0x074548` to `0x074564`), allocates rows times height bytes in the cache for the\npicture's address (`TCache::Allocate`, `0x07456C` to `0x0745B8`) and unpacks the\ndata from its fifth byte (`LZUnpack`, `0x0745D0` to `0x0745D8`). It then lets the\ndata go through slot 12 and sets the count to 1 (`0x0745E0` to `0x074608`). It\nreturns 0, -43 when slot 8 gives no data (`0x074614`) and -108 when the\nallocation fails (`0x0745C8`). The -108 return skips slot 12, so the packed data\nstays where slot 8 left it (`0x0745BC` to `0x0745CC`). Every unpacking sets the\ncount to 1 and does not add 1 to the count it had. A picture that the cache freed while\nseveral users held it therefore counts one user after its next `NewPix`, and the\nfirst `ReleasePix` of the others frees it (an inference, since whether the\nholders lock their pictures in the cache is not traced)."
   },
   {
    "name": "TPixCacheBase::DoneData",
    "entry": 476768,
    "text": "Does nothing (`0x074660`), the slot that a subclass fills to let a picture's\npacked data go."
   },
   {
    "name": "TPixCacheBase::LoadPix",
    "entry": 476820,
    "text": "Gives the pixel map given the address of picture n's pixels, unpacking the\npicture again when the cache has freed it (`0x0746AC` to `0x0746C4`, `0x07476C` to\n`0x074780`). The new block's size is the map's rows times the stored height\n(`0x0746F0` to `0x074724`), so the map must be one that `NewPix` filled. The\nroutine neither moves the block to the head of the ring nor counts a user. It\nreturns 0, -43 when slot 8 gives no data (`0x0746E8`) and -108 when the\nallocation fails (`0x07473C`), and as in `NewPix` the -108 return skips slot 12\n(`0x074730` to `0x074740`)."
   },
   {
    "name": "TPixCacheBase::ReleasePix",
    "entry": 477136,
    "text": "Counts one user fewer of picture n, and when the count reaches 0 frees its block\nin the cache and clears its address (`TCache::Free`, `0x0747E8` to `0x074864`).\nWith a count already at 0 it does nothing (`0x0747F8` to `0x074800`). It returns\n0."
   }
  ]
 },
 "TToDoList": {
  "opening": "The list of the to-do window, a `TListBox` that `TToDo` makes. Each cell's data is\nthe address of one of the 256 to-do entries of 8 bytes at `data+0x6E334`, a flag byte at `+0`, other\nthan 0 for a done entry, and the entry's text as a script value at `+4`.",
  "routines": [
   {
    "name": "TToDoList::TToDoList",
    "entry": 485748,
    "text": "Makes the list as a `TListBox` from the view, the bounds, the cell size and the\nwindow given, with the flags 1, 0, 0 and 1, which `TListBox::TListBox` passes to\n`LNew` in that order, so the list draws, has no grow box and has a vertical scroll\nbar alone (`0x076984` to `0x0769BC`). It sets the vtable to `TToDoList`'s and\nreplaces the scroll bar with a control of definition 16,016, `'CDEF'` 1001 with\nvariation 0, the game's scroll bar (`TListBox::ChangeScrollBars`, `0x0769C4` to\n`0x0769D4`), fills the list (`RebuildList`, `0x0769DC` to `0x0769E0`) and returns\nthe object."
   },
   {
    "name": "TToDoList::LDEFDraw",
    "entry": 485956,
    "text": "Draws a cell, an entry's box and its text. It erases the cell (`EraseRect`,\n`0x076A74`) and draws nothing more unless the cell's data is 4 bytes (`0x076A7C` to\n`0x076A84`), the entry's address (`LGetCell`, `0x076A88` to `0x076AA0`). The box is\n16 by 16 pixels, 2 in from the cell's left with its top 8 above the cell's middle\n(`OffsetRect`, `0x076AA8` to `0x076AF0`), the top left quarter of tile 427 for an\nentry not done and the top right quarter for a done one, the same art as an\nunchecked and a checked check box (`0x076AF8` to `0x076B94`), copied with white\nleft out (the transfer mode 36, `CopyBits`, `0x076B9C` to `0x076BBC`). The text,\nthe entry's script value as a string (`TInterp::VAddrToPtr`, `0x076BC4` to\n`0x076BCC`), goes in text style 4 3 pixels right of the box, 4 above its bottom\n(`MoveTo`, `SetText`, `0x076BD4` to `0x076BFC`), when the string is not 0\n(`AADrawText`, `0x076C04` to `0x076C24`). It then inverts a selected cell in the\nhighlight color (`LMSetHiliteMode`, `InvertRect`, `0x076C2C` to `0x076C50`)."
   },
   {
    "name": "TToDoList::LDEFHilite",
    "entry": 486572,
    "text": "Inverts the cell's rectangle in the highlight color (`LMSetHiliteMode`,\n`InvertRect`, `0x076CBC` to `0x076CD4`), where `TListBox::LDEFHilite` draws the\ncell again."
   },
   {
    "name": "TToDoList::RebuildList",
    "entry": 486696,
    "text": "Fills the list from the 256 to-do entries of 8 bytes at `data+0x6E334`, a flag byte at `+0`, other\nthan 0 for a done entry, and the entry's text as a script value at `+4`, the entries whose text is other than the script's \"nothing\", the word at `data+0x77374`, those not\ndone first and then the done ones, each in the order of the table (`0x076E14` to\n`0x076F14`). It first counts those entries (`0x076D54` to `0x076D8C`) and adds rows\nat the end, or deletes rows from the top, until the list has that many\n(`LAddRow`, `LDelRow`, `0x076D90` to `0x076E0C`), and sets each cell to the entry's\naddress, 4 bytes (`LSetCell`). Drawing is off while it works (`LSetDrawingMode`,\n`0x076D3C` to `0x076D4C`, `0x076F18` to `0x076F20`), and then it erases the list's\nview in the list's port and draws the list within the port's visible region\nthrough slot 52, `Update` (`0x076F28` to `0x076F84`)."
   },
   {
    "name": "TToDoList::~TToDoList",
    "entry": 488160,
    "text": "Sets the vtable to `TToDoList`'s and runs `TListBox::~TListBox`, which disposes\nof the list (`0x0772FC` to `0x07730C`), and frees the object when the flag is above\n0."
   }
  ]
 },
 "TScriptPickItemDrawer": {
  "opening": "The drawer of one line of a list that a script offers the player to pick from,\n12 bytes, its vtable at `+0`, a format string at `+4` and a script list of the\nvalues the format uses at `+8`. The script call `cbPickItem` makes an array of 20\nof them, 12 bytes each (an inference from the sizes of its `construct array`\ncall). In the format, `|` ends a column, `%d`, `%s`, `%i`, `%n` and `%p` each use\nthe next value, and any other character goes on the line as it is.",
  "routines": [
   {
    "name": "TScriptPickItemDrawer::GetItemHeight",
    "entry": 614680,
    "text": "Returns the line's height, 32 when the format has `%i`, a picture, and 20\notherwise (`0x09612C` to `0x096158`)."
   },
   {
    "name": "TScriptPickItemDrawer::DrawItem",
    "entry": 614820,
    "text": "Draws the line in the rectangle given, its text in yellow (69), or in red (205)\nfor a selected line, with a black shadow (`0x0961D4` to `0x0961F8`). It\ngathers text into a buffer and draws it at each `|` and at the end of the format\n(`TextWidth`, `TTextContext::Justify`, `TTextContext::DrawTextOutlined`,\n`0x096214` to `0x0962AC`, `0x0966B8` to `0x09673C`), with the ascent and descent\nof text style 6 to center it by height. The first column starts 2 pixels in from\nthe left (`0x0961FC` to `0x096208`), and each later one where the pen stopped.\nAfter a `|`, a `.` centers the next column and a `-` aligns it right\n(`0x0962B0` to `0x0962DC`), and a number n places it n percent of the way across\nthe rectangle, rounded (`0x0962E0` to `0x096374`). `%d` writes the next value as a\nnumber and `%s` as a string (`sprintf`, `0x096388` to `0x096428`). `%i` draws a\n32-by-32 picture, tile the first tile of prop type n's low 10 bits, from the table of shorts at\n`data+0x60568`, plus n shifted right 10, for a value whose top 4 bits, its type, are\n0, with white left out, centered by height at the\ncolumn's place (`0x09642C` to `0x0965C0`), shifted left 16 for a centered column\nand 32 for a right one (`0x096560` to `0x096598`), and moves the column's place\n36 to the right (`0x0965D8`). A tile of 0 draws nothing. It also moves the pen 0\nacross and 36 down (`Move`, `0x0965C8` to `0x0965D0`). Text gathered before a\n`%i` in the same column goes out only at the next `|` or the end, at the place\nafter the picture, so it shows to the picture's right. `%n` writes the name of\nthe same tile, with the third argument 1 (`GetTileName`, `0x0965E4` to\n`0x096674`), and `%p` and any other letter after `%` use up a value and draw\nnothing (`0x096678` to `0x096698`). The buffer at `148(1)` has 92 bytes below the\nsaved registers at `240(1)`, and nothing bounds what goes into it. A `%` as the\nformat's last character reads the ending zero byte as its letter and steps past it\n(`0x096388`, `0x096690` to `0x096694`), so the loop goes on through the memory after\nthe format."
   },
   {
    "name": "TScriptPickItemDrawer::TScriptPickItemDrawer",
    "entry": 617712,
    "text": "Sets the vtable, first to the base class's and then to this class's, the format\nto 0 and the values to the script's \"nothing\", the word at `data+0x77374`\n(`0x096CF4` to `0x096D18`)."
   }
  ]
 },
 "TFadeInTextImageObject": {
  "opening": "An image object that dissolves a picture in over 10 ticks, the base of\n`TStringFadeInTextImageObject`, which draws a string. A work area is a world at\n`+0` and a rectangle at `+4`. The object has a place at `+4`, the work area of its\npicture at `+12` (the world) and `+16` (the rectangle), a second work area at `+24` and\n`+28`, which the background comes from, a byte at `+36`, a rectangle at `+38`,\nthe count of ticks at `+46` and a short at `+48`.",
  "routines": [
   {
    "name": "TFadeInTextImageObject::TFadeInTextImageObject",
    "entry": 645192,
    "text": "Sets the vtable, the place given, the two work areas, the byte and the short\n(`0x09D868` to `0x09D8E0`), and the count of ticks to 0 (`0x09D8DC`). The rectangle\nat `+38` is the first work area's with its bottom raised by the short\n(`0x09D8E4` to `0x09D8FC`). It then erases the first work area's rectangle in its\nworld (`SetGWorld`, `EraseRect`, `0x09D900` to `0x09D938`)."
   },
   {
    "name": "TFadeInTextImageObject::Tick",
    "entry": 645548,
    "text": "On the first tick it copies the background into the object's world, the second\nwork area's pixels at the object's place, the size of the object's rectangle\n(`OffsetRect`, `CopyBits` in the source copy mode, `0x09DA1C` to `0x09DA8C`), and\ndraws the object's picture over it through slot 16 with the rectangle\n(`0x09DA94` to `0x09DAA4`). It also sets the three shorts at `+50`, `+52` and `+54`\nto 1,024 (`0x09D9FC` to `0x09DA18`). On each later tick it multiplies the three by\n6/5, or sets all three to 65,535 once the first would reach it (`0x09DAC8` to\n`0x09DB88`). Nothing in this class or in `TStringFadeInTextImageObject::Render`\nreads those three. Every tick adds 1 to the count (`0x09DB8C` to `0x09DB94`)."
   },
   {
    "name": "TFadeInTextImageObject::DisBits",
    "entry": 646188,
    "text": "Copies a share of the pixels of a rectangle of 8-bit pixels from one buffer to\nanother, in a fixed scattered order, the percent given of width times height\n(`0x09DC68` to `0x09DCBC`). The order comes from a shift register, a number of as\nmany bits as the width and the height need together (`bitwidth`, `0x09DCD0` to\n`0x09DCE0`), stepped right with an exclusive-or of the tap from the table at toc\n+9352 when the bit shifted out is 1 (`0x09DD88` to `0x09DD9C`). Its high bits are\nthe row and its low bits the column, and the routine passes over a place outside\nthe rectangle (`0x09DD30` to `0x09DD84`). The register starts at the tap when the fourth\nargument is 0 (`0x09DD0C` to `0x09DD28`). It never reaches 0, so the last pixel of\na count of 2 or more is always the top left one (`0x09DDA0` to `0x09DDB0`). The\ntest for a count of 1 comes after the first copy, so a count of 1 copies the\nstart's pixel when it lies inside the rectangle and not the top left one. With the same\nstart each call copies the same pixels first, so a larger percent adds pixels to\nthose a smaller one copied."
   },
   {
    "name": "TFadeInTextImageObject::Apply",
    "entry": 646676,
    "text": "Draws the object into the work area given, at the work area's rectangle's top\nleft plus the object's place (`OffsetRect`, `0x09DE2C` to `0x09DE7C`). After 10\nticks it copies the whole picture (`IsDone`, `CopyBits`, `0x09DE84` to\n`0x09DEB8`). Before that it copies 10 percent of the pixels for each tick so far\n(`DisBits`, with the start 0, `0x09DF3C` to `0x09DF74`), so the picture builds up\nover 10 ticks. The address of the source's first pixel counts the source\nrectangle's top times the destination's row length (`0x09DF24` to `0x09DF48`), not the source's,\nwhich reads the wrong row for a rectangle whose top is not 0 when the two worlds'\nrows differ in length."
   },
   {
    "name": "TFadeInTextImageObject::IsDone",
    "entry": 647116,
    "text": "Returns whether the count of ticks has reached 10 (`0x09DFCC` to `0x09DFE4`)."
   }
  ]
 },
 "TGremlin": {
  "opening": "The gremlins, 256 scripted objects of kind 120, whose scripts are the segments\n`0x1F00` plus n. Every routine is static and works on the table of 256 gremlins at `data+0x773BC`, 4 bytes each, a state as\na short at `+0` and the number of a heap frame for the script's fields as a short\nat `+2`, 0 when it has none. A state of 2 marks a gremlin with no script.",
  "routines": [
   {
    "name": "TGremlin::AllocateFrame",
    "entry": 708548,
    "text": "Returns the heap frame of the gremlin entry given, making one first when it has\nnone (`THeapObj::THeapObj` with 2, `0x0ACFD8` to `0x0AD00C`)."
   },
   {
    "name": "TGremlin::ClearGremlins",
    "entry": 708692,
    "text": "Clears the table of 256 gremlins at `data+0x773BC`, 1,024 bytes (`memset`, `0x0AD05C` to `0x0AD080`), and sets the state\nof each gremlin with no segment in the archive at `data+0x181EC` to 2\n(`ObjIDToSegmentID` with kind 120, `TCachedSegFiles::Exists`, `0x0AD090` to\n`0x0AD0C4`). Its caller is `TDelverApp::NewModel`, for a new game."
   },
   {
    "name": "TGremlin::SaveGremlins",
    "entry": 708900,
    "text": "Writes the table of 256 gremlins at `data+0x773BC` to a stream as a chunk `'Grem'` of its 1,024 bytes (`BeginChunk`,\n`Write`, `EndChunk`, slots 48, 24 and 52, `0x0AD12C` to `0x0AD178`)."
   },
   {
    "name": "TGremlin::LoadGremlins",
    "entry": 709064,
    "text": "Reads the table of 256 gremlins at `data+0x773BC` from a stream's chunk `'Grem'`, 1,024 bytes (`ReadChunk`, `Read`,\nslots 56 and 28, `0x0AD1D0` to `0x0AD208`). Nothing tests whether the read found\nthe chunk, or its length."
   },
   {
    "name": "TGremlin::GetField",
    "entry": 709208,
    "text": "Gives a script field of gremlin n. Field 20 is the state, read as an unsigned\nshort, so a state below 0 comes back as 65,536 plus it (`0x0AD2A0` to\n`0x0AD2B0`). Field 17 is True when the gremlin has a heap frame and False when it\nhas none (`0x0AD2B8` to `0x0AD2F0`). Field 18 is the frame itself, the object\n`0x7000` in the high half and the frame's number in the low, made when it is\nmissing (`0x0AD288` to `0x0AD290`, `AllocateFrame`, `0x0AD2F8` to `0x0AD31C`).\nFields 0 to 16, 19 and 21 up give the script's \"nothing\", the word at\n`data+0x77374` (`0x0AD294`, `0x0AD324` to `0x0AD330`)."
   },
   {
    "name": "TGremlin::SetField",
    "entry": 709492,
    "text": "Sets gremlin n's state to the low 16 bits of the value given for field 20 (`0x0AD378`\nto `0x0AD39C`). Any other field changes nothing."
   },
   {
    "name": "TGremlin::OnEnter",
    "entry": 709588,
    "text": "For each gremlin whose state is 0 or 3 and up, not 1, 2 or below 0, it runs\nthe gremlin's method 20, the object `0x4078` in the high half and the gremlin's\nnumber in the low, with one argument, the value given (`TInterp::DoInterp`, `0x0AD3FC` to `0x0AD444`).\nIts callers are `TGameSys::HeartBeat` and `TGameViewer::ChangeZone`."
   },
   {
    "name": "TGremlin::OnSignal",
    "entry": 709796,
    "text": "For each gremlin whose state is 0 or 3 and up, not 1, 2 or below 0, it runs\nthe gremlin's method 21, the object `0x4078` in the high half and the gremlin's\nnumber in the low, with one argument, the signal given as a number (`TInterp::DoInterp`, `0x0AD4D0` to\n`0x0AD524`). Its caller is `TGameSys::SendSignal`."
   }
  ]
 },
 "TBark": {
  "opening": "A talk balloon, a line of words over a prop, 16 bytes. It has its vtable at `+0`,\nan offscreen world of 128 by 32 pixels at `+4`, a byte at `+8`, other than 0 while\nthe balloon shows, the prop's number as a short at `+10` and the balloon's variant,\n0 to 7, as a short at `+12`. In the variant, bit 0 marks a prop above the present\ncharacter, bit 1 a prop in its column or right of it, and bit 2 two lines.\nThe shapes are the regions that `InitBalloons` makes. The static routines work on\nthe four barks whose addresses are at `data+0x6A8C8`, made on the first call of `SetBark`.",
  "routines": [
   {
    "name": "TBark::TBark",
    "entry": 400640,
    "text": "Sets the vtable (`0x061D28` to `0x061D30`) and makes the world, 8 bits deep, 128 by\n32, with the color table that `data+0x60D6C` points to (`SetRect`, `NewGWorld`,\n`0x061D10` to `0x061D5C`), throwing \"Can't allocate bark\" when that fails\n(`0x061D64` to `0x061D80`). It locks the world's pixels (`0x061D88` to `0x061D98`),\nsets bit `0x4000` of the flags of the world's color table and gives the world the\npalette that `data+0x60D68` points to (`SetPalette`, `0x061DA0` to `0x061DC8`). The\nvariant and the showing byte start at 0 (`0x061DD0` to `0x061DE0`), and the world's\ntext is style 5 (`SetText`, `0x061DEC` to `0x061E28`)."
   },
   {
    "name": "TBark::~TBark",
    "entry": 401012,
    "text": "Sets the vtable and frees the object when the flag is above 0 (`0x061E90` to\n`0x061EA8`). Nothing disposes of the world."
   },
   {
    "name": "TBark::Draw",
    "entry": 401132,
    "text": "Copies the balloon onto the current port through the variant's region as the\nmask, in the source copy mode (`CopyBits`, `0x06207C` to `0x062094`). The place is\nthe prop's square less the present character's, from the location words of\nprop record n and of the character record at `data+0x28558` plus 32 times the short\nat `data+0x19C66`, plus the short at `+2` of the record that `data+0x6A8C0` points to, both ways,\ntimes 32, plus 16 and the variant's two shorts in the table at `data+0x6A8D8`, the\nsecond across and the first down (`0x061EF4` to `0x061FD8`). With bit `0x80` of\nbyte 0 of the \"UI Prefs\" record at toc -5216, set in the shipped record (`0x98`),\nand bit `0x04` of the prop's flags, it adds 8 times bits 0 and 1 of the prop's\nbyte 6 across and 8 times bits 4 and 5 down (`0x061F64` to `0x061F74`, `0x061FCC` to `0x062000`). The region moves to\nthe place for the copy and back after it (`OffsetRgn`, `0x062004` to `0x062010`,\n`0x06209C` to `0x0620A8`). Before the copy the seed of the world's color table\nbecomes the long at `data+0x60D74` (`0x062048` to `0x062078`)."
   },
   {
    "name": "TBark::SetMessage",
    "entry": 401640,
    "text": "Draws the words given into the balloon's world for prop n. It erases the world\n(`EraseRect`, `0x062108` to `0x062140`), stores n and sets the variant from\nthe prop's square less the present character's, from the location words of\nprop record n and of the character record at `data+0x28558` plus 32 times the short\nat `data+0x19C66` (`0x06216C` to `0x062210`). The words center on x 68 for a prop left of the\npresent character and on 60 otherwise. Words 112 pixels wide or less go on one\nline at a baseline of 11 (`TextWidth`, `MoveTo`, `AADrawText`, `0x062310` to\n`0x06234C`). Wider ones break once to fit 112 pixels, the first line at a baseline\nof 13 and the rest at 25, the variant's bit 2 set (`StyledLineBreak`, `0x062214`\nto `0x062304`), and the second line goes untested against the width. The routine\nthen frames the variant's region in the world (`FrameRgn`, `0x062354` to\n`0x062364`) and sets the world back (`0x06236C` to `0x06237C`)."
   },
   {
    "name": "TBark::SetBark",
    "entry": 402372,
    "text": "Shows the string given over prop n and returns the tick when it should go, 240\nafter the present one (`TickCount`, `0x062518` to `0x062520`). The first call runs\n`InitBalloons` and makes the four barks whose addresses are at `data+0x6A8C8`, each 0 when the allocation fails, which nothing tests\nafter (`0x0623D0` to `0x06245C`). The balloon is the one already over prop n, or\nelse the first that is not showing (`0x062460` to `0x0624C4`). With neither, the\nroutine returns 0 (`0x0624C8` to `0x0624D0`). It marks the balloon as showing and\ndraws the words into it (`TInterp::VAddrToPtr`, `SetMessage`, `0x0624D8` to\n`0x062514`)."
   },
   {
    "name": "TBark::RemoveBark",
    "entry": 402788,
    "text": "Marks every balloon over prop n as not showing (`0x062568` to `0x0625B4`)."
   },
   {
    "name": "TBark::DrawBarks",
    "entry": 402924,
    "text": "Draws each of the four barks whose addresses are at `data+0x6A8C8` that is showing (`Draw`, `0x0625F4` to `0x062640`)."
   }
  ]
 },
 "TDrawerWDEF": {
  "opening": "The window definition object of the game's drawers, `'WDEF'` 1002, a `TWDEF`. A\ndrawer has a title bar 18 pixels high above its content and opens upward from its\nbottom edge, its height 0 or 64 and up in steps of 16, the shorts at `+12` and\n`+14`.",
  "routines": [
   {
    "name": "TDrawerWDEF::Create",
    "entry": 677612,
    "text": "Allocates 16 bytes and makes a drawer's definition in them for the window and\nthe variation code given (`0x0A5700` to `0x0A5724`), and returns it, or 0 when\nthe allocation fails."
   },
   {
    "name": "TDrawerWDEF::TDrawerWDEF",
    "entry": 677760,
    "text": "Makes a `TWDEF` for the window (`0x0A57A4`), sets the vtable to `TDrawerWDEF`'s\n(`0x0A57AC` to `0x0A57B8`), and sets the smallest open height, `+12`, to 64 and the\nstep, `+14`, to 16 (`0x0A57B0` to `0x0A57C4`)."
   },
   {
    "name": "TDrawerWDEF::DrawUnhilited",
    "entry": 677908,
    "text": "Draws the frame. It frames the structure region's bounds and, within them, a\ntitle bar of 18 pixels at the top (`FrameRect`, `0x0A5828` to `0x0A5860`), and\nfills the bar inside its frame with the top half of tile 412 (`InsetRect`,\n`ExpandHorizontally`, `0x0A5868` to `0x0A5888`). Under the title it draws a tab\nfrom the bottom half of the same tile, 16 pixels wider than the title and\ncentered (`0x0A590C` to `0x0A5960`), and then the title in text style 0,\ncentered across the bar and by the style's ascent down it (`SetText`,\n`StringWidth`, `MoveTo`, `AADrawText`, `0x0A58C4` to `0x0A59D4`), with the title's\nhandle locked meanwhile (`HGetState`, `HLock`, `HSetState`, `0x0A58CC` to\n`0x0A58F0`, `0x0A59E4` to `0x0A59F0`). It calls `TryDrawContent`, which does\nnothing (`0x0A59DC` to `0x0A59E0`), and sets the port's font, style and size back\n(`0x0A5890` to `0x0A58C0`, `0x0A59F8` to `0x0A5A1C`)."
   },
   {
    "name": "TDrawerWDEF::DrawHilited",
    "entry": 678508,
    "text": "Draws the frame through slot 16, `DrawUnhilited`, with the same variation code\n(`0x0A5A7C` to `0x0A5A90`), so an active drawer looks the same as an inactive\none."
   },
   {
    "name": "TDrawerWDEF::Grow",
    "entry": 678620,
    "text": "Draws the outline of a drawer during a resize and, while the button is down, stores\nthe new size in the rectangle given. The new height is the rectangle's height\nfitted to the drawer's sizes, 0 for a height of 0 or less, 64 for up to 64, and\notherwise 64 plus a whole number of steps of 16, rounded (`0x0A5AFC` to\n`0x0A5B70`). The content's bottom stays where it is and its top moves to the\nbottom less the height, from the content region's bounds, or for a closed drawer\nfrom the structure region's, inset by 1 and less the bar (`EmptyRect`,\n`InsetRect`, `0x0A5B74` to `0x0A5BE8`). The routine then moves the top down 16 at a\ntime until the bar clears the first 20 pixels of the screen, the menu bar (an\ninference) (`0x0A5BF0` to `0x0A5C0C`). The rectangle receives the size only while\n`StillDown` returns other than 0 (`0x0A5C10` to `0x0A5C2C`). The outline is the\nrectangle 1 wider each side and 18 taller at the top, with a line under the bar\nwhen the content is not empty (`FrameRect`, `MoveTo`, `LineTo`, `0x0A5C30` to\n`0x0A5C9C`)."
   },
   {
    "name": "TDrawerWDEF::Test",
    "entry": 679152,
    "text": "Returns the part of the window at a point, 1, the content, inside the content\nregion, and 3 everywhere else (`PtInRgn`, `0x0A5D04` to `0x0A5D2C`), Apple's\n`wInGrow` (an inference from the number), so a press on the bar resizes the\ndrawer."
   },
   {
    "name": "TDrawerWDEF::CalcRegions",
    "entry": 679280,
    "text": "Sets the content region to the rectangle given (`RectRgn`, `0x0A5D90` to\n`0x0A5D98`) and the structure region to it 1 wider each side and 16 taller at the\ntop for an empty one, or 17 taller otherwise (`InsetRect`, `RectRgn`, `0x0A5DA0`\nto `0x0A5E14`)."
   },
   {
    "name": "TDrawerWDEF::~TDrawerWDEF",
    "entry": 691508,
    "text": "Sets the vtable to `TDrawerWDEF`'s and runs `TWDEF::~TWDEF` (`0x0A8D50` to\n`0x0A8D60`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TWindow": {
  "opening": "The base of the game's windows. The object has its vtable at `+0`, its window's\nrecord at `+4` and its flags as a short at `+8`. The window's kind, `+108` of the\nrecord, is 31,364 and its reference is the object. The vtable's slots are 8 the\ndestructor, 12 `DrawRoutine`, 16 `NeedsRedraw`, 20 `ActivateRoutine`, 24\n`DeactivateRoutine`, 28 `MenuRoutine`, 32 `CommandRoutine`, 36 `CloseRoutine`, 40\n`MouseRoutine`, 44 `KeyRoutine`, 48 `GetResizeRect`, 52 `ResizeRoutine`, 56\n`ZoomRoutine`, 60 `CursorRoutine`, 64 `IdleRoutine`, 68 `LoopTask`, 72\n`HandleDragWindow`, 76 `HandleSelectWindow`, 80 `HandleResizeWindow`, 84\n`HandleMonitorChanged`, 88 `HandleZoomWindow`, 92 `GetOwningGD`, 96\n`ForceOnGDevice`, 100 `PutInALayer`, 104 `Select`, 108 `Show`, 112 `Hide`, 116\n`HandleDeactivate`, 120 `HandleActivate`, 124 `Dock` and 128 `UnDock`.\n\nThe flags' low 3 bits are the window's layer. From front to back the layers stack\n3 (and 4 up), 1, 0 and 2. Bit `0x08` hides the window while the player is away from the game and bit `0x10` while a modal state lasts, and `0x4000` marks a window that one of\nthe two hid. Bit `0x20` stops a click from selecting the window, and `0x40` makes the\nwindow dock. Bits `0x100` to `0x2000` say how the window follows a screen whose\nsize changes (`HandleMonitorChanged`).",
  "routines": [
   {
    "name": "TWindow::TWindow",
    "entry": 36548,
    "text": "Sets the vtable, no window and flags of 0 (`0x008EC4` to `0x008ED8`)."
   },
   {
    "name": "TWindow::~TWindow",
    "entry": 36612,
    "text": "Sets the vtable (`0x008F20` to `0x008F24`) and, with a window, hides it through\nslot 112, `Hide`, and disposes of it (`DisposeWindow`, `0x008F28` to `0x008F4C`). It\nclears the window's address and frees the object when the flag is above 0\n(`0x008F54` to `0x008F6C`)."
   },
   {
    "name": "TWindow::TWindow",
    "entry": 36784,
    "text": "Sets the vtable (`0x008FC0`, `0x008FD8`) and adopts the window given with the\nflags given (`Init`, `0x008FDC`)."
   },
   {
    "name": "TWindow::TWindow",
    "entry": 36908,
    "text": "Sets the vtable (`0x00904C` to `0x009054`) and makes a window from the `'WIND'`\nresource given, in front of the others, a color window when the byte at `+20` of\nthe application object at `data+0x60E0C` is other than 0 and a plain one otherwise (`GetNewCWindow`, `GetNewWindow`,\n`0x00903C` to `0x00909C`), and adopts it with the flags given (`Init`, `0x0090A0`\nto `0x0090AC`). The new window goes untested, so a failed `GetNewWindow` reaches\n`Init` with address 0."
   },
   {
    "name": "TWindow::Init",
    "entry": 37112,
    "text": "Makes the window given the current port and the object's window (`SetPort`,\n`0x00911C` to `0x009124`), puts it in its layer with the flags given through slot\n100, `PutInALayer` (`0x009128` to `0x009138`), sets its kind to 31,364 and its\nreference to the object (`SetWRefCon`, `0x009140` to `0x009150`)."
   },
   {
    "name": "TWindow::NeedsRedraw",
    "entry": 37824,
    "text": "Returns 1 when the window is visible and its update region, `+122` of the record,\nis a region that is not empty, and 0 otherwise, or with no window (`EmptyRgn`,\n`0x0093D8` to `0x00941C`)."
   },
   {
    "name": "TWindow::AnyNeedsRedraw",
    "entry": 37988,
    "text": "Returns 1 when any window from the front with a `TWindow` answers 1 to slot 16,\n`NeedsRedraw`, and 0 otherwise (`FrontWindow`, `GetTWindow`, `0x009478` to\n`0x0094CC`)."
   },
   {
    "name": "TWindow::DrawRoutine",
    "entry": 38168,
    "text": "Does nothing (`0x009518`)."
   },
   {
    "name": "TWindow::ActivateRoutine",
    "entry": 38360,
    "text": "Does nothing (`0x0095D8`)."
   },
   {
    "name": "TWindow::DeactivateRoutine",
    "entry": 38608,
    "text": "Does nothing (`0x0096D0`)."
   },
   {
    "name": "TWindow::MenuRoutine",
    "entry": 38856,
    "text": "Returns 0 (`0x0097C8`)."
   },
   {
    "name": "TWindow::CommandRoutine",
    "entry": 38908,
    "text": "Closes the window through slot 36, `CloseRoutine`, for command 4 and returns 1, and\nreturns 0 for any other command (`0x009814` to `0x009838`)."
   },
   {
    "name": "TWindow::CloseRoutine",
    "entry": 39036,
    "text": "Hides the window through slot 112, `Hide` (`0x00988C` to `0x009898`)."
   },
   {
    "name": "TWindow::MouseRoutine",
    "entry": 39132,
    "text": "Does nothing (`0x0098DC`)."
   },
   {
    "name": "TWindow::KeyRoutine",
    "entry": 39668,
    "text": "Sends the keys 256, 257, 258, 259 and 8 as the commands 11, 12, 13, 14 and 15\nthrough slot 32, `CommandRoutine` (`0x009B0C` to `0x009BC4`). Any other key does\nnothing. The keys 256 to 259 are F1 to F4, which `TApp::TranslateKey` makes of\nApple's key codes `0x7A`, `0x78`, `0x63` and `0x76`, and 8 is the character of the\nDelete key. A dialog's command routine, `TDialog::CommandRoutine`, handles the\ncommands 12 to 15 as Cut, Copy, Paste and Clear."
   },
   {
    "name": "TWindow::ResizeRoutine",
    "entry": 40460,
    "text": "Does nothing (`0x009E0C`)."
   },
   {
    "name": "TWindow::ZoomRoutine",
    "entry": 40508,
    "text": "Zooms the window. A window that docks, bit `0x40`, undocks through slot 128 when\nits port's rectangle has no height, and otherwise docks through slot 124 with a\nwidth of 80 and a step of 16 (`0x009E50` to `0x009EA4`). The routine erases any other window and zooms it to its user state (`EraseRect`, `ZoomWindow` with 7, Apple's `inZoomIn`, `0x009EB0` to `0x009ED8`), and then runs slot 52, `ResizeRoutine`\n(`0x009EE0` to `0x009EEC`). The part given goes unread."
   },
   {
    "name": "TWindow::Dock",
    "entry": 40756,
    "text": "Docks the window as a strip of its title bar at the right edge of the main\nscreen, the width given, and zooms it there (`ZoomWindow` with 8, Apple's\n`inZoomOut`, `0x00A054` to `0x00A07C`). The routine works out the place, the standard state of the window's state data at `+130` of the record, unless the state already has no height (`0x009F5C` to `0x009F88`). Its right is the screen's right and its\nleft that less the width (`0x009F8C` to `0x009FB0`, `0x00A020` to `0x00A034`). Its\ntop is 40 plus the step times a count of docks, the short at `data+0x60E04`, which\nstarts at 0 (the byte at `data+0x60E02` marking it) and goes up 1 each time, so the\nfirst dock goes at 40 plus the step. A place within 20 pixels of the screen's bottom\nstarts the count again at 1 (`0x009FB4` to `0x00A01C`). The window's user state\nthen becomes the docked place and its standard state the place it had\n(`0x00A084` to `0x00A0B8`), so the next zoom undocks it."
   },
   {
    "name": "TWindow::UnDock",
    "entry": 41212,
    "text": "Zooms the window to its standard state, the size it had before it docked\n(`ZoomWindow` with 8, `0x00A10C` to `0x00A154`), and swaps the window's user and\nstandard states (`0x00A15C` to `0x00A190`), so the next zoom docks it again."
   },
   {
    "name": "TWindow::CursorRoutine",
    "entry": 41424,
    "text": "Sets the cursor through slot 72 of the application object at `data+0x60E0C`, `ResetCursor` (`0x00A1D4` to\n`0x00A1EC`)."
   },
   {
    "name": "TWindow::IdleRoutine",
    "entry": 41528,
    "text": "Does nothing (`0x00A238`)."
   },
   {
    "name": "TWindow::LoopTask",
    "entry": 41768,
    "text": "Does nothing (`0x00A328`)."
   },
   {
    "name": "TWindow::GetTWindow",
    "entry": 41848,
    "text": "Returns the `TWindow` of the window given, its reference, when the window's kind\nis 31,364, and 0 otherwise or for no window (`NoDA`, `GetWRefCon`, `0x00A380` to\n`0x00A3B8`). The test of `NoDA` always passes, since it returns 1."
   },
   {
    "name": "TWindow::HandleDragWindow",
    "entry": 41988,
    "text": "Moves the window while the player drags it from the point given. A docked window,\nbit `0x40` and a port with no height, does not move (`0x00A420` to `0x00A444`), and\nnothing happens when the button is already up (`WaitMouseUp`, `0x00A448` to\n`0x00A454`). With the byte at `+103` of the application object at `data+0x60E0C` other than 0 the window moves with the mouse. Clipped to the desktop less the windows in front of it (`GetGrayRgn`,\n`DiffRgn`, `0x00A48C` to `0x00A4D4`), it moves each time the mouse does\n(`GetMouse`, `MoveWindow`, `0x00A4F0` to `0x00A588`, `StillDown`, `0x00A6AC`), and\nwith the byte at `+104` other than 0 the routine draws it again as it goes, its update region through slot 12, `DrawRoutine`, and the other windows' updates through slot\n164 of the application, `HandleUpdateEvt`, until `CheckUpdate` finds none, the\napplication's event record at `+4` kept aside meanwhile (`0x00A590` to\n`0x00A69C`). Otherwise the outline of the structure region follows the mouse within\nthe screen (`DragGrayRgn`, `0x00A6CC` to `0x00A764`), and the window moves by the distance once the player releases the button, unless the drag ends outside the limit or\ngoes nowhere (`MoveWindow`, `0x00A778` to `0x00A7CC`). The two walks that cut the\nwindows in front out of the clip stop only at this window, with no test for the\nend of the list (`0x00A4AC` to `0x00A4D4`, `0x00A70C` to `0x00A730`), so a window missing\nfrom the list after `FrontWindow` sends them through address 0. Neither path puts\nback the Window Manager port's clip (`0x00A48C`, `0x00A6F4`)."
   },
   {
    "name": "TWindow::HandleSelectWindow",
    "entry": 43036,
    "text": "Selects the window through slot 104, `Select`, unless its flags have bit `0x20`\n(`0x00A830` to `0x00A848`)."
   },
   {
    "name": "TWindow::GetResizeRect",
    "entry": 43164,
    "text": "Sets the rectangle given to the limits of a resize, 64 to 32,000 pixels each way\n(`SetRect`, `0x00A8A0` to `0x00A8C0`)."
   },
   {
    "name": "TWindow::HandleResizeWindow",
    "entry": 43276,
    "text": "Resizes the window as the player drags its size box from the point given, within\nthe limits from slot 48, `GetResizeRect` (`GrowWindow`, `0x00A928` to `0x00A948`),\nand when the size changed sets it (`SizeWindow`, `0x00A950` to `0x00A96C`) and runs\nslot 52, `ResizeRoutine` (`0x00A974` to `0x00A980`)."
   },
   {
    "name": "TWindow::HandleZoomWindow",
    "entry": 43480,
    "text": "Tracks a press in the zoom box (`TrackBox`, `0x00A9F8` to `0x00AA00`) and, when the\nplayer releases it inside, zooms the window through slot 56, `ZoomRoutine`, with the\npart given (`0x00AA08` to `0x00AA20`)."
   },
   {
    "name": "TWindow::HandleMonitorChanged",
    "entry": 43640,
    "text": "Moves and sizes the window after the screen given changes from the first\nrectangle given to the second, when slot 92, `GetOwningGD`, names that screen\n(`0x00AA98` to `0x00AAAC`). The size grows or shrinks with the screen's width for\nflag `0x1000` and with its height for `0x2000` (`0x00AB0C` to `0x00AB60`). Across,\nflags `0x300` together keep the window's middle at the same share of the screen\n(`MapPt`, `0x00AB64` to `0x00ABC4`), `0x100` preserves its distance from the right edge\n(`0x00ABC8` to `0x00ABF0`), and with neither the window's distance from the left edge\nstays the same (`0x00AC50` to `0x00AC64`). Flag `0x200` alone means to keep the window\ncentered, but the instructions add the old centered place to the new one rather\nthan taking their difference (`0x00ABF8` to `0x00AC48`). Down, flags `0xC00`,\n`0x400` and `0x800` do the same with the height, the bottom edge and the centered\nplace, the same addition included for `0x800` (`0x00AC68` to `0x00AD4C`), and with\nneither the top edge stays (`0x00AD50` to `0x00AD64`). The routine sizes and moves the window only when the size or the place changed (`SizeWindow`, `MoveWindow`,\n`0x00AD68` to `0x00ADDC`)."
   },
   {
    "name": "TWindow::GetOwningGD",
    "entry": 44608,
    "text": "Returns the screen that the window is most on. It starts with the screen given\nand the area where the rectangle given meets the window's port's rectangle\n(`SectRect`, `0x00AE6C` to `0x00AEBC`), and then switches to any screen whose rectangle\nmeets the port's rectangle over as large an area or more (`GetDeviceList`,\n`TestDeviceAttribute` with 13, `GetNextDevice`, `0x00AEC0` to `0x00AF70`). The\nport's rectangle is in the window's local coordinates, so the areas count from the\nglobal origin, the main screen's top left, not from where the window is (an\ninference). With no overlap at\nall it returns 0."
   },
   {
    "name": "TWindow::ForceOnGDevice",
    "entry": 45000,
    "text": "Moves the window back onto the screen given when less than 32 pixels of it, either\nway, lie within the screen's content less 10 pixels each side (`GetGDevContent`,\nslot 132 of the application object at `data+0x60E0C`, `InsetRect`, `SectRect`, `0x00AFE4` to `0x00B098`). It moves the\nwindow left and up until its right and bottom edges are inside, then right and\ndown until its left and top edges are, so a window too big for the screen ends at\nits top left (`MoveWindow`, `0x00B09C` to `0x00B134`). The corners of the port's\nrectangle go to global coordinates with no `SetPort` first (`LocalToGlobal`,\n`0x00B000`, `0x00B010`), so they come out right only when the window is already the\ncurrent port."
   },
   {
    "name": "TWindow::PutInALayer",
    "entry": 45644,
    "text": "Sets the window's flags to those given and moves the window into its layer, the window's layer, the low 3 bits of its flags\n(`0x00B26C` to `0x00B2F0`). A window of layer 2 goes behind all the others\n(`SendBehind`), one of layer 3 and up to the front, one of layer 1 behind the backmost\nvisible window of layer 3, and one of layer 0 behind the backmost visible window of\nlayer 1, or else of layer 3, each to the front when there is none\n(`FindLayer`, `SendBehind`, `BringToFront`, `0x00B2F0` to `0x00B310`). A visible\nwindow is then selected through slot 104, `Select` (`0x00B318` to\n`0x00B334`)."
   },
   {
    "name": "TWindow::Select",
    "entry": 45956,
    "text": "Brings the window forward in its layer and draws it. A window of layer 1 not\nalready the frontmost of its layer goes behind the backmost window of layer 3, or to\nthe front, and shows (`0x00B3C8` to `0x00B420`). For a window of layer 0 not\nalready the frontmost of its layer, the routine deactivates the old one through slot\n116, puts the window behind the backmost of layer 1, or else of layer 3, or to the\nfront, shows it and activates it through slot 120 (`0x00B42C` to `0x00B4E8`). A\nwindow of layer 0 already in front shows and activates (`0x00B4F4` to `0x00B514`).\nOther layers stay where they are. Every window then has its update drawn through slot\n12, `DrawRoutine` (`BeginUpdate`, `EndUpdate`, `0x00B51C` to `0x00B54C`)."
   },
   {
    "name": "TWindow::Show",
    "entry": 46660,
    "text": "Shows a hidden window by its layer (`0x00B660` to `0x00B768`). A window of layer 2\nshows where it is. One of layer 0 shows and activates through slot 120, and\ndeactivates the old frontmost window of layer 0 when the old one is in front of the\nnew (`InFrontOf`, `0x00B6A0` to `0x00B704`). Showing a window leaves the order as it\nwas, so the old window then stays in front, without its highlight when the byte at\n`+101` of the application object at `data+0x60E0C` is 0, and the new one gains none in `HandleActivate`, since it is not\nthe frontmost. When the new window is in\nfront, both keep a highlight. The test reads as the reverse of its purpose (an\ninference). One of layer 1 comes to the front, shows and\nactivates (`0x00B734` to `0x00B760`), and one of layer 3 shows through\n`ShowWindow` (`0x00B710` to `0x00B714`). A window of layer 4 and up stays\nhidden."
   },
   {
    "name": "TWindow::Hide",
    "entry": 47016,
    "text": "Hides a visible window by its layer (`0x00B7BC` to `0x00B91C`). A window of layer\n2 or 1 just hides. When the frontmost window of layer 0 hides, the routine activates the next one through slot 120 and puts the hidden window behind it (`0x00B7FC` to\n`0x00B868`). When the frontmost window of layer 3 hides, the routine activates the next of layer 3, or else the frontmost of layer 0, the same way (`0x00B86C` to `0x00B8F4`). A\nwindow of layer 4 and up stays visible."
   },
   {
    "name": "TWindow::HandleActivate",
    "entry": 47444,
    "text": "Activates the window for the reasons given, bits such as 8, the game's return,\nand 16, the end of a modal state, when it is not highlighted (`0x00B96C` to\n`0x00B97C`). A window whose flags share a bit with the reasons loses bit `0x4000`\nand goes through `ShowHide` with 0, which hides it, not shows it (`0x00B980` to\n`0x00B9A4`). A window that `HandleDeactivate` hid for a reason therefore stays\nhidden, and `Resume` and `EndModal` pass over hidden windows in any case. No\nwindow of the game has either bit. The constructors pass the flags 0, 3, `0xF00`,\n`0x3002`, `0x421` and `0x521`, and no routine adds `0x08` or `0x10` to a window's\nflags, so neither routine ever hides a window this way. A window of layer 1, or one of\nlayer 0 that is the frontmost visible window of layer 0 (`FindLayer`), gains its highlight and runs slot 20, `ActivateRoutine`\n(`HiliteWindow`, `0x00B9AC` to `0x00BA28`)."
   },
   {
    "name": "TWindow::HandleDeactivate",
    "entry": 47736,
    "text": "Deactivates a highlighted window for the reasons given (`0x00BA90` to\n`0x00BAA0`). A window of layer 1, or one of layer 0 that is the frontmost visible window of layer 0 (`FindLayer`) while the byte at\n`+101` of the application object at `data+0x60E0C` is 0, loses its highlight and runs slot 24, `DeactivateRoutine`\n(`HiliteWindow`, `0x00BAA4` to `0x00BB34`). A window whose flags share a bit with the\nreasons then hides and gains bit `0x4000` (`ShowHide`, `0x00BB3C` to\n`0x00BB60`)."
   },
   {
    "name": "TWindow::Suspend",
    "entry": 48048,
    "text": "Deactivates the windows as the player switches away from the game, with the\nreason 8 through slot 116, `HandleDeactivate`. During a modal state, by the count of modal states, the short at `data+0x60E00`, the routine deactivates only the frontmost visible window of layer 3 (`FindLayer`)\n(`0x00BBB8` to `0x00BC00`), and otherwise every visible window that has a `TWindow`, front to back (`0x00BC0C` to\n`0x00BC58`)."
   },
   {
    "name": "TWindow::Resume",
    "entry": 48288,
    "text": "Activates the windows as the player comes back to the game, with the reason 8\nthrough slot 120, `HandleActivate`, during a modal state only the frontmost visible window of layer 3 (`FindLayer`) (`0x00BCA8` to\n`0x00BCF0`) and otherwise every visible window that has a `TWindow`, from the window\nlist (`LMGetWindowList`, `0x00BCFC` to `0x00BD48`)."
   },
   {
    "name": "TWindow::BeginModal",
    "entry": 48528,
    "text": "Adds 1 to the count of modal states, the short at `data+0x60E00`, and for the first modal state deactivates every visible window that has a `TWindow`, front to back with the reason 16\nthrough slot 116 (`0x00BD98` to `0x00BE14`)."
   },
   {
    "name": "TWindow::EndModal",
    "entry": 48732,
    "text": "Lowers the count of modal states, the short at `data+0x60E00` by 1, and when it reaches 0 activates every visible window that has a `TWindow`, front to back with the reason 16 through slot\n120 (`0x00BE64` to `0x00BEE0`)."
   },
   {
    "name": "TWindow::FindLayer",
    "entry": 48932,
    "text": "Returns the frontmost visible window of the layer given that has a `TWindow`, or\nthe backmost when the first argument is 0, or 0 when there is none (`FrontWindow`,\n`GetTWindow`, `0x00BF40` to `0x00BFA0`)."
   }
  ]
 },
 "TStringFadeInTextImageObject": {
  "opening": "A `TFadeInTextImageObject` whose picture is a string, the C string at `+56`,\ndrawn in lines whose height is the short at `+48`.",
  "routines": [
   {
    "name": "TStringFadeInTextImageObject::TStringFadeInTextImageObject",
    "entry": 647204,
    "text": "Makes a `TFadeInTextImageObject` from the two work areas, the place, the line\nheight and the byte given (`0x09E038` to `0x09E064`), sets the vtable and stores\nthe string (`0x09E068` to `0x09E078`)."
   },
   {
    "name": "TStringFadeInTextImageObject::Render",
    "entry": 647404,
    "text": "Draws the string into the rectangle given, broken into lines as wide as the\nrectangle (`StyledLineBreak`, `VisibleLength`). It first counts the lines\n(`0x09E10C` to `0x09E1A0`), and centers the block of lines, the count times the\nline height, down the rectangle (`0x09E1A4` to `0x09E1D0`). Each line starts\nat the rectangle's left with its baseline at the line's top, so the first line\nsits its ascent above the centered block (`MoveTo`, `DrawText`, `0x09E1E0` to\n`0x09E2BC`). The text is cyan (273) and the color black again after it\n(`ForeColor`, `0x09E1D4` to `0x09E1D8`, `0x09E2C0` to `0x09E2C4`)."
   }
  ]
 },
 "TDrawerWindow": {
  "opening": "A window that opens and closes like a drawer at the bottom of its place, a\n`TWindow` drawn by `TDrawerWDEF`. The object adds a byte at `+12`, other than 0\nwhile the drawer is open, and the height it had when last closed as a short at\n`+14`. Its vtable's slots 132 and 136 are `BecomeVisible` and `BecomeNotVisible`.",
  "routines": [
   {
    "name": "TDrawerWindow::~TDrawerWindow",
    "entry": 487672,
    "text": "Sets the vtable to `TDrawerWindow`'s and runs `TWindow::~TWindow` (`0x077114` to\n`0x077124`), and frees the object when the flag is above 0."
   },
   {
    "name": "TDrawerWindow::HandleResizeWindow",
    "entry": 679532,
    "text": "Opens, closes or resizes the drawer from a press on its bar. Nothing happens\nwhen the button is already up (`WaitMouseUp`, `0x0A5E8C` to `0x0A5E98`). While the\nbutton is down it draws the window definition's outline in the exclusive-or mode with the\ngray pattern, on the desktop less the windows in front of the drawer, and moves the\noutline's top with the mouse (`TDrawerWDEF::Grow` through slot 40 of the definition\nobject in the window's data at `+130`, `GetMouse`, `StillDown`, `0x0A5E84` to\n`0x0A6014`). A press with no movement opens a closed drawer to the height it had,\nor closes an open one and records its height (`0x0A6044` to `0x0A60D4`). A drawer\nthat had no height to go back to receives a rectangle 1 high, run through `Grow`, which\nchanges it only while the button is down (`0x0A6088` to `0x0A60B4`). That call\ncomes after the pen is back to black and the caller's port is current again\n(`0x0A601C` to `0x0A603C`), and `Grow` draws its outline as well, so a solid black\noutline stays in whatever port was current. A drawer\nreaching 0 high runs slot 136, `BecomeNotVisible`, and one leaving 0 runs slot 132,\n`BecomeVisible`, each marking the byte at `+12` (`0x0A60F4` to `0x0A6158`). The\nroutine sizes a taller drawer and then moves it up by the difference, so its bottom\nstays, and moves a shorter one down and then sizes it (`SizeWindow`, `MoveWindow`,\n`0x0A6160` to `0x0A6238`), each followed by slot 52, `ResizeRoutine`. Last it\nredraws every window through slot 64 of the application object at `data+0x60E0C`,\n`RedrawAllNow` (`0x0A6254` to `0x0A6264`)."
   },
   {
    "name": "TDrawerWindow::HandleMonitorChanged",
    "entry": 680640,
    "text": "Moves and sizes the drawer as `TWindow::HandleMonitorChanged` does, for the main screen, the device at `data+0x60D78` alone\n(`0x0A62C8` to `0x0A6300`)."
   },
   {
    "name": "TDrawerWindow::GetOwningGD",
    "entry": 680812,
    "text": "Returns the main screen, the device at `data+0x60D78` (`0x0A636C` to `0x0A6370`), whatever the window's place."
   },
   {
    "name": "TDrawerWindow::BecomeVisible",
    "entry": 680888,
    "text": "Does nothing (`0x0A63B8`)."
   },
   {
    "name": "TDrawerWindow::BecomeNotVisible",
    "entry": 680944,
    "text": "Does nothing (`0x0A63F0`)."
   }
  ]
 },
 "TPixsWDEF": {
  "opening": "The window definition object of the windows framed by a picture, `'WDEF'` 1001, a\n`TWDEF` of 76 bytes. The picture is one of the interface pictures of the picture cache that `data+0x6E20C` points to, its shape\nthe window's structure. The object has the picture's pixel map at `+12`, a region\nat `+64` for the part of the close bar outside the picture, the content's place in\nthe picture as the shorts at `+68` (across) and `+70` (down), and the picture's\nnumber at `+72`. All three come from the window's reference at its making, the\nnumber its high half and the two places its two low bytes.",
  "routines": [
   {
    "name": "TPixsWDEF::Create",
    "entry": 674168,
    "text": "Allocates 76 bytes and makes a picture frame's definition in them for the window\nand the variation code given (`0x0A498C` to `0x0A49B0`), and returns it, or 0 when\nthe allocation fails."
   },
   {
    "name": "TPixsWDEF::~TPixsWDEF",
    "entry": 674312,
    "text": "Sets the vtable (`0x0A4A24` to `0x0A4A28`), lets go of the picture in the picture cache that `data+0x6E20C` points to when\nits number is not 0 (`TPixCacheBase::ReleasePix`, `0x0A4A2C` to `0x0A4A44`),\ndisposes of the region at `+64` (`0x0A4A4C` to `0x0A4A50`) and runs `TWDEF::~TWDEF`\n(`0x0A4A58` to `0x0A4A60`), and frees the object when the flag is above 0."
   },
   {
    "name": "TPixsWDEF::TPixsWDEF",
    "entry": 674496,
    "text": "Makes a `TWDEF` for the window (`0x0A4AE8`) and sets the vtable (`0x0A4AF0` to\n`0x0A4AF8`). It reads the window's reference (`GetWRefCon`, `0x0A4AFC`) into the\npicture's number and the content's two places (`0x0A4B04` to `0x0A4B28`), and\nstarts the pixel map as a copy of the record at toc -5276 (`0x0A4B08`, `0x0A4B2C` to\n`0x0A4B90`). With a variation code of 0 it fills the map from the picture cache that `data+0x6E20C` points to, and leaves the\npixels at 0 when that fails (`TPixCacheBase::NewPix`, `0x0A4B94` to `0x0A4BBC`).\nAny other code leaves them at 0 (`0x0A4BC4` to `0x0A4BC8`). It then makes the\nregion at `+64` (`NewRgn`, `0x0A4BCC` to `0x0A4BD4`)."
   },
   {
    "name": "TPixsWDEF::HiliteCloseBox",
    "entry": 674864,
    "text": "Draws the close box, 16 by 16 pixels at the structure's left, a quarter of the way\ndown less 4, the top left 16 by 16 quarter of tile 431, or its bottom left quarter for a highlight\nother than 0, in the source copy mode (`OffsetRect`, `CopyBits`, `0x0A4C34` to\n`0x0A4D80`)."
   },
   {
    "name": "TPixsWDEF::DrawUnhilited",
    "entry": 675276,
    "text": "Draws the frame. With a variation code of 0 it first unpacks the picture again\nwhen the cache freed it (`TPixCacheBase::LoadPix`, `0x0A4DF0` to `0x0A4E0C`), and\nwith no pixels it draws nothing (`0x0A4E14` to `0x0A4E1C`). A window with a close\nbox receives its close bar, the region at `+64` moved to the box's place (`OffsetRgn`,\n`0x0A4E3C` to `0x0A4E9C`). The bar starts with tile 431's top left 16 by 16 quarter as the box\n(`0x0A4EA4` to `0x0A4FF4`), repeats columns 16 to 23 through the region as the mask,\n8 pixels at a time (`0x0A4FFC` to `0x0A5094`), and ends with columns 24 to 31, at the\nwindow's middle plus 8, or 32 past the box when that is further (`0x0A4F88` to\n`0x0A4FC8`, `0x0A5098` to `0x0A50E0`). Then the picture goes on with the picture's bottom right corner at the structure region's, its top the\nbounds' bottom less the picture's height and its left their right less its width, through the\nstructure region less the content region and the bar's region as the mask\n(`NewRgn`, `DiffRgn`, `CopyBits`, `0x0A50E8` to `0x0A5188`)."
   },
   {
    "name": "TPixsWDEF::ContentFromFrame",
    "entry": 676328,
    "text": "Copies a window's whole frame picture, with no mask, into the\nport given, or the current port when it is 0 (`0x0A51F0` to `0x0A5214`). The\npicture goes where the frame puts it, the picture's bottom right corner at the structure region's, its top the\nbounds' bottom less the picture's height and its left their right less its width, moved so the content's top left is at\n(0, 0) (`OffsetRect`, `0x0A5218` to `0x0A52AC`), unpacked again when the cache freed\nit (`TPixCacheBase::LoadPix`, `0x0A52B4` to `0x0A52C4`), and copied in the source\ncopy mode (`CopyBits`, `0x0A52CC` to `0x0A52E4`), so only the port's clip limits it\nto the content. The routine ignores `LoadPix`'s result and copies with no test of the\naddress of the pixels, which is 0 after a failed allocation and the old address\nafter a failed load. The object is the one in the window's data at `+130`\n(`0x0A5220`)."
   },
   {
    "name": "TPixsWDEF::DrawHilited",
    "entry": 676676,
    "text": "Draws the frame through slot 16, `DrawUnhilited`, with the same variation code\n(`0x0A5354` to `0x0A5368`), so an active window looks the same as an inactive\none."
   },
   {
    "name": "TPixsWDEF::Test",
    "entry": 676784,
    "text": "Returns the part of the window at a point, 1, the content, inside the content\nregion (`PtInRgn`, `0x0A53C8` to `0x0A53E4`), 4, the close box, inside the close box, 16 by 16 pixels at the structure's left, a quarter of the way\ndown less 4 for a\nwindow with one (`PtInRect`, `0x0A53EC` to `0x0A5470`), and 2, the frame,\neverywhere else (`0x0A5478`), Apple's `wInContent`, `wInGoAway` and `wInDrag` (an\ninference from the numbers)."
   },
   {
    "name": "TPixsWDEF::CalcRegions",
    "entry": 677052,
    "text": "Sets the content region to the rectangle given (`RectRgn`, `0x0A54D8` to\n`0x0A54E8`). With the picture's pixels (`TPixCacheBase::LoadPix` for a variation\ncode of 0, `0x0A54F0` to `0x0A551C`) the structure region becomes the picture's\nshape (`MyPMToRegion`, `0x0A5520` to `0x0A5538`), moved so the content's place in\nthe picture falls at the rectangle's top left (`OffsetRgn`, `0x0A553C` to\n`0x0A555C`), and the content region shrinks to the part within it (`SectRgn`,\n`0x0A5564` to `0x0A557C`). For a window with a close box the bar is a rectangle 16\nhigh from 16 left of the shape to its middle, at least 32 wide, a quarter of the\nway down less 4 (`0x0A5584` to `0x0A5630`). Its part outside the shape becomes the\nregion at `+64` and joins the structure (`RectRgn`, `DiffRgn`, `UnionRgn`,\n`0x0A5634` to `0x0A5670`). Without the pixels, or when the shape fails, the\nstructure region is the rectangle given (`0x0A567C` to `0x0A5698`)."
   }
  ]
 },
 "TDialog": {
  "opening": "The base of the dialogs that the game draws itself, those of `TCreatePlayerDialog`, `TAIDebug` and\n`TEditUserBehavior`, a `TWindow` of layer 3 around a Dialog Manager dialog. Its\nvtable adds slot 132, `DialogItemRoutine`, for an item the player uses, and slot\n136, `DialogDrawRoutine`.",
  "routines": [
   {
    "name": "TDialog::TDialog",
    "entry": 37280,
    "text": "Makes the `TWindow` (`0x0091BC`), sets the vtable (`0x0091C0` to `0x0091D0`), makes\nthe dialog from the `'DLOG'` resource given, in front of the other windows\n(`GetNewDialog`, `0x0091C4` to `0x0091D4`), adopts it with the flags 3, layer 3\n(`TWindow::Init`, `0x0091DC` to `0x0091EC`), and gives its user items their drawing\nroutine (`InstallUserItems`, `0x0091F0` to `0x0091F4`)."
   },
   {
    "name": "TDialog::InstallUserItems",
    "entry": 37436,
    "text": "Gives every user item of the dialog, an item of type 0 with or without the\ndisabled bit, `MyDrawDialogItem` as its routine (`CountDITL`, `GetDialogItem`,\n`SetDialogItem`, `0x009284` to `0x0092F0`), through a routine descriptor made once and\nkept at `data+0x60E08` (`NewRoutineDescriptor`, `0x009250` to `0x009280`)."
   },
   {
    "name": "TDialog::DrawRoutine",
    "entry": 38216,
    "text": "Draws the dialog (`DrawDialog`, `0x009558` to `0x009560`)."
   },
   {
    "name": "TDialog::DialogDrawRoutine",
    "entry": 38308,
    "text": "Does nothing (`0x0095A4`)."
   },
   {
    "name": "TDialog::ActivateRoutine",
    "entry": 38412,
    "text": "It passes the event record at `+4` of the application object at `data+0x60E0C` to the Dialog Manager with the window's\nkind set to 2 for the call, the dialog kind, and to 31,364 again after it\n(`DialogSelect`, `0x009628` to `0x009650`), and sends an item that the event hits to slot 132,\n`DialogItemRoutine` (`0x009658` to `0x009670`)."
   },
   {
    "name": "TDialog::DeactivateRoutine",
    "entry": 38660,
    "text": "It passes the event record at `+4` of the application object at `data+0x60E0C` to the Dialog Manager with the window's\nkind set to 2 for the call, the dialog kind, and to 31,364 again after it\n(`DialogSelect`, `0x009720` to `0x009748`), and sends an item that the event hits to slot 132,\n`DialogItemRoutine` (`0x009750` to `0x009768`)."
   },
   {
    "name": "TDialog::MouseRoutine",
    "entry": 39188,
    "text": "It passes the event record at `+4` of the application object at `data+0x60E0C` to the Dialog Manager with the window's\nkind set to 2 for the call, the dialog kind, and to 31,364 again after it\n(`DialogSelect`, `0x009930` to `0x009958`), and sends an item that the event hits to slot 132,\n`DialogItemRoutine` (`0x009960` to `0x009978`)."
   },
   {
    "name": "TDialog::DialogItemRoutine",
    "entry": 39388,
    "text": "Does nothing (`0x0099DC`)."
   },
   {
    "name": "TDialog::DialogKeyEquiv",
    "entry": 39440,
    "text": "Uses item n as a key would. A control item, of type 4 to 7 with or without the\ndisabled bit, flashes highlighted for 8 ticks (`GetDialogItem`, `HiliteControl` with\n10 and then 0, `Delay`, `0x009A2C` to `0x009A8C`), and every item goes to slot 132,\n`DialogItemRoutine` (`0x009A94` to `0x009AA4`)."
   },
   {
    "name": "TDialog::KeyRoutine",
    "entry": 39948,
    "text": "Cuts, copies and pastes in the dialog's text for the keys 257, 258 and 259, F2,\nF3 and F4 (`DialogCut`, `DialogCopy`, `DialogPaste`, `0x009C2C` to `0x009C78`).\nFor any other key, it passes the event record at `+4` of the application object at `data+0x60E0C` to the Dialog Manager with the window's\nkind set to 2 for the call, the dialog kind, and to 31,364 again after it\n(`DialogSelect`, `0x009C84` to `0x009CAC`), and sends an item that the event hits to slot 132,\n`DialogItemRoutine` (`0x009CB4` to `0x009CCC`)."
   },
   {
    "name": "TDialog::CommandRoutine",
    "entry": 40232,
    "text": "Handles the commands 12 to 15, Cut, Copy, Paste and Clear, in the dialog's text,\nand returns 1 (`DialogCut`, `DialogCopy`, `DialogPaste`, `DialogDelete`, `0x009D3C`\nto `0x009DB4`). Any other command goes to `TWindow::CommandRoutine` (`0x009DB8` to\n`0x009DC0`)."
   },
   {
    "name": "TDialog::IdleRoutine",
    "entry": 41576,
    "text": "It passes the event record at `+4` of the application object at `data+0x60E0C` to the Dialog Manager with the window's\nkind set to 2 for the call, the dialog kind, and to 31,364 again after it\n(`DialogSelect`, `0x00A284` to `0x00A2AC`), and sends an item that the event hits to slot 132,\n`DialogItemRoutine` (`0x00A2B4` to `0x00A2CC`)."
   },
   {
    "name": "TDialog::~TDialog",
    "entry": 67212,
    "text": "Sets the vtable to `TDialog`'s and runs `TWindow::~TWindow`, which disposes of\nthe window (`0x0106A8` to `0x0106B8`), and frees the object when the flag is above\n0."
   }
  ]
 },
 "TCreatePlayerDialog": {
  "opening": "The dialog for making the hero, `'DLOG'` 133, a `TDialog`. Its items are 1 OK, 2\nCancel, 3 the portrait, 5 Male and 6 Female, 7 the list of archetypes, 8 the\narchetype's description, 9 its attributes and 10 its aptitudes. The object adds the\nanswer as a short at `+12`, 1 for OK and 0 for Cancel, the sex as a short at `+14`,\n1 for Male and 0 for Female, the archetype as a short at `+16`, the portrait list at\n`+20`, the archetype list at `+24`, and the handles of the descriptions, the\nattributes and the aptitudes, resources `0x204`, `0x205` and `0x206`, at `+28`, `+32`\nand `+36`.",
  "routines": [
   {
    "name": "TCreatePlayerDialog::TCreatePlayerDialog",
    "entry": 658072,
    "text": "Makes the dialog from `'DLOG'` 133 (`TDialog::TDialog`, `0x0A0AB0` to `0x0A0AC8`)\nand dresses it in the game's controls (`FaceADialog`, `0x0A0ACC` to `0x0A0ADC`).\nThe portrait list fills item 3 less 1 pixel each side and 16 on the right for its\nscroll bar, cells of 64 by 64 in three rows and two columns, with its selection\nflags 0 (`TPortraitList::TPortraitList`, `0x0A0AE4` to `0x0A0BA0`), so it shows one\nportrait at a time. The archetype list fills item 7 the same way, cells of 200 by\n20 in one column (`TArchetypeList::TArchetypeList`, `0x0A0BA4` to `0x0A0C1C`).\nA failed allocation skips its list's constructor and stores 0\n(`0x0A0B5C` to `0x0A0B7C`, `0x0A0BFC`), and nothing tests the 0 after that, so the\nportrait list's next steps read through it (`0x0A0B94`) and `LAddRow` reads it for\nthe archetype list (`0x0A0CD8`). The\nlist's rows are the names in resource `0x203` of the scenario at `data+0x181FC`,\ndecrypted, the count in the low 12 bits of the first short and each name entry n of a resource, the text at the offset in the short at `4` plus 4n\n(`TSegFile::LoadSegment`, `TSegFile::Decrypt`, `LAddRow`, `LSetCell`, `0x0A0C20` to\n`0x0A0D28`), copied through the buffer at `data+0x76316`, and the routine selects\nits first row (slot 12, `0x0A0D30` to `0x0A0D40`). The routine then loads and decrypts\n`0x204`, `0x205` and `0x206` (`0x0A0D48` to `0x0A0E6C`). A missing resource throws\n\"No Archetype names\", \"No Archetype descriptions\", \"No Archetype stats\" or \"No\nArchetype skills\". Male starts on (`SetControlValue`, `0x0A0E74` to `0x0A0EA4`),\nthe window shows, filled with the pattern of tile 420 (`ShowWindow`, `FillCRect`,\n`0x0A0EA8` to `0x0A0ECC`), and archetype 0's texts go on (`AdjustCurArch`,\n`0x0A0ED4` to `0x0A0EDC`)."
   },
   {
    "name": "TCreatePlayerDialog::AdjustCurArch",
    "entry": 659244,
    "text": "Makes archetype n the present one and draws its texts. It stores n\n(`0x0A0F64`), and erases items 8, 9 and 10 and draws in each, in text style 4,\nentry n of a resource, the text at the offset in the short at `4` plus 4n, `0x204`, `0x205` and `0x206` (`GetDialogItem`, `EraseRect`, `TETextBox`,\n`0x0A0F50` to `0x0A10DC`), and sets text style 0 again after (`0x0A10E4` to\n`0x0A10E8`). Each text passes through a buffer of 256 bytes on the stack with no\nbound (`strcpy`, `0x0A0FAC`, `0x0A1038`, `0x0A10B8`)."
   },
   {
    "name": "TCreatePlayerDialog::DrawRoutine",
    "entry": 659788,
    "text": "Fills the window with the pattern of tile 420 (`SetTilePat`, `FillCRect`,\n`0x0A115C` to `0x0A1178`) and draws the dialog (`TDialog::DrawRoutine`,\n`0x0A1180` to `0x0A1184`)."
   },
   {
    "name": "TCreatePlayerDialog::~TCreatePlayerDialog",
    "entry": 659928,
    "text": "Sets the vtable (`0x0A11F4` to `0x0A11F8`), destroys the portrait list\n(slot 60, `0x0A11FC` to `0x0A1214`), disposes of the dialog and of the three handles\n(`DisposeDialog`, `DisposeHandle`, `0x0A121C` to `0x0A1274`), clears the window and\nruns `TWindow::~TWindow` (`0x0A127C` to `0x0A129C`), and frees the object when the flag\nis above 0. Nothing destroys the archetype list at `+24`."
   },
   {
    "name": "TCreatePlayerDialog::GetPortrait",
    "entry": 660372,
    "text": "Returns the portrait's number, 240 plus 6 times the portrait list's visible\ncolumn plus its visible row, the shorts at `+22` and `+20` of the list's record\n(`0x0A139C` to `0x0A13CC`). So the portrait is the one in view, Male's column 0 or\nFemale's column 1, scrolled to row 0, 1 or 2. The hero's portrait is resource\n`0x87FF` plus this number, which `CreatePlayer` reads."
   },
   {
    "name": "TCreatePlayerDialog::DialogItemRoutine",
    "entry": 660492,
    "text": "Handles a press on an item. Cancel sets the answer to 0, and OK sets it to 1 and\nthe archetype to the list's selection (slot 8), each setting the byte at `+29` of the application object at `data+0x60E0C`\nto 1 (`0x0A1460` to `0x0A14AC`). Male, when Female was on, turns Female off and\nMale on and scrolls the portrait list one column left (`SetControlValue`, `LScroll`,\n`0x0A14B0` to `0x0A152C`), and Female does the opposite, one column right\n(`0x0A1538` to `0x0A15B4`)."
   },
   {
    "name": "TCreatePlayerDialog::DialogDrawRoutine",
    "entry": 661016,
    "text": "Draws a user item. The routine draws items 3 and 7, the two lists, within the\nwindow's visible region through slot 52, `Update`, and frames them (`FrameRect`,\n`0x0A164C` to `0x0A16B4`), and item 8 draws the present archetype's texts (`AdjustCurArch`,\n`0x0A16BC` to `0x0A16D0`)."
   },
   {
    "name": "TCreatePlayerDialog::MouseRoutine",
    "entry": 661292,
    "text": "Sends a press in item 7 to the archetype list (slot 48, `Click`), and draws the\nnew archetype's texts when the selection changed (`GetDialogItem`, `PtInRect`,\n`AdjustCurArch`, `0x0A1750` to `0x0A17F8`). A press in item 3 goes to the portrait\nlist (`0x0A1800` to `0x0A1848`), and any other press to `TDialog::MouseRoutine`\n(`0x0A1854` to `0x0A1860`)."
   }
  ]
 },
 "TPushButtonCDEF": {
  "opening": "The control definition object of the game's push buttons, `'CDEF'` 1000 with variation 0 in the\nlow 3 bits, a `TCDEF`. Its drawing is `DrawButton`.",
  "routines": [
   {
    "name": "TPushButtonCDEF::TPushButtonCDEF",
    "entry": 681004,
    "text": "Makes a `TCDEF` for the control (`0x0A6450`) and sets the vtable to `TPushButtonCDEF`'s (`0x0A6458` to\n`0x0A6460`)."
   },
   {
    "name": "TPushButtonCDEF::Create",
    "entry": 681144,
    "text": "Allocates 8 bytes and makes a push button in them for the control given (`0x0A64CC` to `0x0A64F0`), and\nreturns it, or 0 when the allocation fails."
   },
   {
    "name": "TPushButtonCDEF::DrawAPart",
    "entry": 681292,
    "text": "Draws the control with `DrawButton`, the control's rectangle, its title, `+40` of\nthe record, and a state (`0x0A660C` to `0x0A6624`), 1 when the highlight, byte 17\nof the record, is 10 or 1 (`0x0A6568` to `0x0A6584`), 2 for a highlight of 255,\ninactive (`0x0A658C` to `0x0A65B4`), and 0 otherwise. The states are tiles 424, 425\nand 426. With bit 3 of the variation code set, Apple's `useWFont` (an inference from the\nnumber), it first sets the port's font, size and style to the window's (`TextFont`,\n`TextSize`, `TextFace`, `0x0A65C4` to `0x0A6604`), which changes nothing on the screen, since\n`DrawButton` sets the title's text style and the port's back after it."
   },
   {
    "name": "TPushButtonCDEF::~TPushButtonCDEF",
    "entry": 691292,
    "text": "Sets the vtable to `TPushButtonCDEF`'s and runs `TCDEF::~TCDEF` (`0x0A8C78` to `0x0A8C88`), and frees the\nobject when the flag is above 0."
   },
   {
    "name": "TPushButtonCDEF::GetPreferedCTable",
    "entry": 691436,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A8CEC` to `0x0A8CF0`)."
   }
  ]
 },
 "TNumberCDEF": {
  "opening": "The control definition object of the game's numbers with no arrows, `'CDEF'` 1002 with variation 1 in the\nlow 3 bits, a `TCDEF`. Its drawing is `DrawNumberField`.",
  "routines": [
   {
    "name": "TNumberCDEF::TNumberCDEF",
    "entry": 682952,
    "text": "Makes a `TCDEF` for the control (`0x0A6BEC`) and sets the vtable to `TNumberCDEF`'s (`0x0A6BF4` to\n`0x0A6BFC`)."
   },
   {
    "name": "TNumberCDEF::Create",
    "entry": 683088,
    "text": "Allocates 8 bytes and makes a number in them for the control given (`0x0A6C64` to `0x0A6C88`), and\nreturns it, or 0 when the allocation fails."
   },
   {
    "name": "TNumberCDEF::DrawAPart",
    "entry": 683232,
    "text": "Draws the control's value, the short at `+18` of the record, as a number field\nwith no arrows (`DrawNumberField` with the part -1, `0x0A6D54` to `0x0A6D70`). With bit 3 of the variation code set, Apple's `useWFont` (an inference from the\nnumber), it first sets the port's font, size and style to the window's (`TextFont`,\n`TextSize`, `TextFace`, `0x0A6D0C` to `0x0A6D4C`), which changes nothing on the screen, since\n`DrawNumberField`, through `DrawButton`, sets the title's text style and the port's back after it."
   },
   {
    "name": "TNumberCDEF::~TNumberCDEF",
    "entry": 690644,
    "text": "Sets the vtable to `TNumberCDEF`'s and runs `TCDEF::~TCDEF` (`0x0A89F0` to `0x0A8A00`), and frees the\nobject when the flag is above 0."
   },
   {
    "name": "TNumberCDEF::GetPreferedCTable",
    "entry": 690784,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A8A60` to `0x0A8A64`)."
   }
  ]
 },
 "TEditNumberCDEF": {
  "opening": "The control definition object of the game's editable numbers, `'CDEF'` 1002 with variation 0 in the\nlow 3 bits, a `TCDEF`. Its drawing is `DrawNumberField`, with the two arrows that step the number.",
  "routines": [
   {
    "name": "TEditNumberCDEF::TEditNumberCDEF",
    "entry": 683500,
    "text": "Makes a `TCDEF` for the control (`0x0A6E10`), sets the vtable to `TEditNumberCDEF`'s and\nthe control's action routine, `+32` of the record, to -1 (`0x0A6E18` to `0x0A6E2C`),\nApple's sign that the definition itself handles a press held down (an inference)."
   },
   {
    "name": "TEditNumberCDEF::Create",
    "entry": 683656,
    "text": "Allocates 8 bytes and makes a editable number in them for the control given (`0x0A6E9C` to `0x0A6EC0`), and\nreturns it, or 0 when the allocation fails."
   },
   {
    "name": "TEditNumberCDEF::Test",
    "entry": 683804,
    "text": "Returns the part of the field at the point given, 20 for the up arrow and 21 for\nthe down arrow (`FindNumberFieldPart`, `0x0A6F34` to `0x0A6F54`)."
   },
   {
    "name": "TEditNumberCDEF::Action",
    "entry": 683940,
    "text": "Steps the value while the player holds an arrow, 1 up for part 20 and 1 down for\npart 21 (`0x0A6FC0` to `0x0A6FE4`), within the control's minimum and maximum, the\nshorts at `+20` and `+22` (`SetControlValue`, `0x0A7040` to `0x0A70A4`). The next\nstep waits for the tick at `data+0x77360`. The first step comes at once and sets\nthat tick a double-click time later (`LMGetDoubleTime`), and each later one 10 ticks\nafter the last (`TickCount`, `0x0A6FF0` to `0x0A703C`)."
   },
   {
    "name": "TEditNumberCDEF::DrawAPart",
    "entry": 684272,
    "text": "Draws the control's value, the short at `+18` of the record, as a number field\nwith its arrows, the highlight, byte 17 of the record, as the part pressed\n(`DrawNumberField`, `0x0A7164` to `0x0A7180`), and with no highlight sets the tick of\nthe next step back to 0, so the next press steps at once (`0x0A7188` to\n`0x0A719C`). With bit 3 of the variation code set, Apple's `useWFont` (an inference from the\nnumber), it first sets the port's font, size and style to the window's (`TextFont`,\n`TextSize`, `TextFace`, `0x0A711C` to `0x0A715C`), which changes nothing on the screen, since\n`DrawNumberField`, through `DrawButton`, sets the title's text style and the port's back after it."
   },
   {
    "name": "TEditNumberCDEF::~TEditNumberCDEF",
    "entry": 690428,
    "text": "Sets the vtable to `TEditNumberCDEF`'s and runs `TCDEF::~TCDEF` (`0x0A8918` to `0x0A8928`), and frees the\nobject when the flag is above 0."
   },
   {
    "name": "TEditNumberCDEF::GetPreferedCTable",
    "entry": 690572,
    "text": "Returns the color table that `data+0x60D6C` points to (`0x0A898C` to `0x0A8990`)."
   }
  ]
 },
 "TBorderWDEF": {
  "opening": "The window definition object of the game's framed windows, `'WDEF'` 1000, a\n`TWDEF` of 12 bytes. The frame is `FrameBox`'s, 16 pixels deep, with the window's\ntitle on its top edge. A variation code of 4 adds a size box at the bottom right,\nand 1 draws the frame's other edges and no title.",
  "routines": [
   {
    "name": "TBorderWDEF::Create",
    "entry": 671524,
    "text": "Allocates 12 bytes and makes a framed window's definition in them for the window\nand the variation code given (`0x0A3F38` to `0x0A3F5C`), and returns it, or 0 when\nthe allocation fails."
   },
   {
    "name": "TBorderWDEF::TBorderWDEF",
    "entry": 671672,
    "text": "Makes a `TWDEF` for the window (`0x0A3FDC`) and sets the vtable to `TBorderWDEF`'s\n(`0x0A3FE4` to `0x0A3FEC`)."
   },
   {
    "name": "TBorderWDEF::DrawUnhilited",
    "entry": 671804,
    "text": "Draws the frame around the bounds of the structure region, `+114` of the window's record with `FrameBox` (`0x0A4060` to `0x0A4070`). The style is\n2, a close box in the top left corner, for a window with a close box, the byte at\n`+112` of its record, and 0 otherwise (`0x0A407C` to `0x0A4094`), plus 4, a size box\nin the bottom right corner, for the variation code 4, or 1, the other quarters of the\nedges' tiles, for the code 1 (`0x0A4098` to `0x0A40C0`). The window's title,\n`+134` of the record, goes on the top edge with its handle locked meanwhile\n(`HGetState`, `HLock`, `HSetState`, `0x0A40D0` to `0x0A4148`), except for the code\n1 or a window with no title (`0x0A4154` to `0x0A4160`). It then calls\n`TryDrawContent`, which does nothing (`0x0A4168` to `0x0A416C`)."
   },
   {
    "name": "TBorderWDEF::HiliteCloseBox",
    "entry": 672196,
    "text": "Draws the close box at the top left of the bounds of the structure region, `+114` of the window's record, highlighted or not by the third\nargument (`HiliteGoAwayFrame`, `0x0A41D4` to `0x0A4200`)."
   },
   {
    "name": "TBorderWDEF::DrawHilited",
    "entry": 672332,
    "text": "Draws the frame through slot 16, `DrawUnhilited`, with the same variation code\n(`0x0A4260` to `0x0A4270`), so an active window looks the same as an inactive\none."
   },
   {
    "name": "TBorderWDEF::Grow",
    "entry": 672444,
    "text": "Draws the outline of a window during a resize and, while the button is down,\nstores the new size in the rectangle given. The new size is a square whose side is\nthe rectangle's shorter side rounded to a multiple of 64, from its top left\n(`0x0A42D4` to `0x0A4368`), stored only while `StillDown` returns other than 0\n(`0x0A436C` to `0x0A4388`). A test that adds 1 to an even count can never pass,\nsince the count is twice a number plus 1 (`0x0A432C` to `0x0A433C`), and a\nrectangle under 32 pixels on its shorter side becomes a square of side 0. The\noutline is that square and a second rectangle 16\npixels outside it, for the frame (`FrameRect`, `InsetRect`, `0x0A438C` to\n`0x0A43B0`)."
   },
   {
    "name": "TBorderWDEF::Test",
    "entry": 672768,
    "text": "Returns the part of the window at a point, 1, the content, inside the content\nregion (`PtInRgn`, `0x0A4418` to `0x0A443C`), 4, the close box, inside the 16 by 16\npixels at the top left of the bounds of the structure region, `+114` of the window's record for a window with a close box (`PtInRect`, `0x0A4440`\nto `0x0A44A4`), 3, the size box, inside the 16 by 16 at its bottom right for the\nvariation code 4 (`0x0A44A8` to `0x0A4508`), and 2, the frame, everywhere else\n(`0x0A450C`), Apple's `wInContent`, `wInGoAway`, `wInGrow` and `wInDrag` (an\ninference from the numbers)."
   },
   {
    "name": "TBorderWDEF::CalcRegions",
    "entry": 673108,
    "text": "Sets the content region to the rectangle given and the structure region to it 16\npixels wider on each side (`RectRgn`, `InsetRect`, `0x0A4574` to `0x0A45B4`)."
   },
   {
    "name": "TBorderWDEF::~TBorderWDEF",
    "entry": 691792,
    "text": "Sets the vtable to `TBorderWDEF`'s and runs `TWDEF::~TWDEF` (`0x0A8E6C` to\n`0x0A8E7C`), and frees the object when the flag is above 0."
   }
  ]
 },
 "TThinBorderWDEF": {
  "opening": "The window definition object of the game's windows with a thin frame, `'WDEF'` 1003,\na `TWDEF` of 12 bytes, the frame of style 8 of `FrameBox`, 8 pixels at the sides and\n4 at the top and bottom, with no title.",
  "routines": [
   {
    "name": "TThinBorderWDEF::Create",
    "entry": 673292,
    "text": "Allocates 12 bytes and makes a thin frame's definition in them for the window and\nthe variation code given (`0x0A4620` to `0x0A4644`), and returns it, or 0 when the\nallocation fails."
   },
   {
    "name": "TThinBorderWDEF::TThinBorderWDEF",
    "entry": 673444,
    "text": "Makes a `TWDEF` for the window (`0x0A46C8`) and sets the vtable to\n`TThinBorderWDEF`'s (`0x0A46D0` to `0x0A46D8`)."
   },
   {
    "name": "TThinBorderWDEF::DrawUnhilited",
    "entry": 673580,
    "text": "Draws the frame around the bounds of the structure region, `+114` of the window's record with `FrameBox` in style 8 and no title (`0x0A473C` to\n`0x0A4768`), and calls `TryDrawContent`, which does nothing (`0x0A4770` to\n`0x0A4774`)."
   },
   {
    "name": "TThinBorderWDEF::DrawHilited",
    "entry": 673732,
    "text": "Draws the frame through slot 16, `DrawUnhilited`, with the same variation code\n(`0x0A47D8` to `0x0A47E8`)."
   },
   {
    "name": "TThinBorderWDEF::Test",
    "entry": 673848,
    "text": "Returns 1, the content, for a point inside the content region, and 0, no part,\neverywhere else (`PtInRgn`, `0x0A4854` to `0x0A4874`), so the frame neither drags\nnor closes the window."
   },
   {
    "name": "TThinBorderWDEF::CalcRegions",
    "entry": 673980,
    "text": "Sets the content region to the rectangle given and the structure region to it 8\npixels wider at the sides and 4 at the top and bottom (`RectRgn`, `InsetRect`,\n`0x0A48DC` to `0x0A491C`)."
   },
   {
    "name": "TThinBorderWDEF::~TThinBorderWDEF",
    "entry": 691648,
    "text": "Sets the vtable to `TThinBorderWDEF`'s and runs `TWDEF::~TWDEF` (`0x0A8DDC` to\n`0x0A8DEC`), and frees the object when the flag is above 0."
   }
  ]
 },
 "": {
  "opening": "",
  "routines": [
   {
    "name": "what__Q23std9bad_allocCFv",
    "entry": 17984,
    "text": "Returns \"Allocation Failure\" (`0x004640`)."
   },
   {
    "name": "what__Q23std11logic_errorCFv",
    "entry": 18036,
    "text": "Returns the error's message, the address at `+4` of the object (`0x004698`)."
   },
   {
    "name": "what__Q23std9exceptionCFv",
    "entry": 18140,
    "text": "Returns \"exception\" (`0x0046DC`)."
   },
   {
    "name": "ExitToShell__FPCUc",
    "entry": 19560,
    "text": "Ends the game after a fatal error. It sets the screen's gamma back\n(`GammaFadeIn` with 10, `0x004C78` to `0x004C7C`). `\"Fatal Error: \"` and the\nmessage given become the alert's text (`ParamText`, `0x004C84` to `0x004C94`). It shows the\narrow and the stop alert 1024 (`InitCursor`, `StopAlert`, `0x004C9C` to `0x004CAC`),\nshows the menu bar again through slot 100 of the application object at\n`data+0x60E0C`, `ShowMenuBar` (`0x004CB4` to `0x004CC4`), and quits\n(`ExitToShell`, `0x004CCC`)."
   },
   {
    "name": "LoadTiles__Fv",
    "entry": 20608,
    "text": "Loads the tile pictures, resources `0x8E00` to `0x8E9F` from the archive at\n`data+0x181FC`, each decompressed into 16,384 bytes of the buffer that\n`data+0x60564` points to (`TSegLoad`, `LZUnpack`, `0x0050B8` to `0x005154`), with a\nspinning cursor (`0x0050A4` to `0x0050C4`). A missing resource leaves its part\nzeros (`0x00511C` to `0x005134`). So the buffer has 160 resources of 16\nimages of 1,024 bytes, 2,560 tiles."
   },
   {
    "name": "BuildCompoTile__FPUcP15CompoTileRecord",
    "entry": 20904,
    "text": "Builds a 32-by-32 tile of 8-bit pixels into the buffer given from 16 pieces of 8\nby 8, listed in the record given as 4 rows of 4 shorts (`0x0051B8` to\n`0x005258`). The low 12 bits of a short pick a tile from the table of tile\naddresses at `data+0x4C564`, bits 14 and 15 the piece's column in that tile and\nbits 12 and 13 its row (`0x0051EC` to `0x005210`). The routine copies each line of a piece as 8 bytes (`0x005214` to `0x005220`)."
   },
   {
    "name": "LoadDisplacementFilters__Fv",
    "entry": 21152,
    "text": "Loads the motion filters, the `'FILT'` resources 0 to 255, into the 256 filters' tables, the handles at `data+0x15D9C`, the\nframe pointers at `data+0x1599C`, the ends at `data+0x1559C`, the 4-byte\nheaders at `data+0x1519C` and the 32-byte masks from `data+0x1619C` (`0x0052CC` to\n`0x0053A0`). A missing one has a frame pointer of 0. It moves a loaded one high and locks it (`0x005314` to `0x005324`). Its first 4 bytes go to the header, the\nnext 32 to the mask, and its frames start at byte 36 and end with the resource\n(`0x00532C` to `0x005390`)."
   },
   {
    "name": "DisplacementFilterTile__FPUcPUcUc",
    "entry": 21480,
    "text": "Copies a 32-by-32 tile of 8-bit pixels through the motion filter given. With\nbit 3 of byte 1 of the \"UI Prefs\" record at toc -5216 clear (Motion Filters\noff), or with no such filter, the routine copies the tile as it is (`0x005408` to `0x005424`,\n`0x005430` to `0x005440`, `0x0054C4` to `0x0054D0`). Otherwise each pixel whose\ncolor has its bit set in the filter's mask (bit `c & 7` of byte `c >> 3`) gives way to the pixel that the frame's signed byte for it points to, counted\nfrom that pixel, and the other pixels go across as they are (`0x005458` to `0x0054BC`). The offset is not bounded, so a pixel near the tile's edge can come from outside the tile."
   },
   {
    "name": "AdvanceDisplacementFilters__Fv",
    "entry": 21792,
    "text": "Moves each loaded motion filter on by one tick (`0x00553C` to `0x005600`). It lowers a filter's countdown, byte 1 of its header, by 1 (`0x0055DC` to\n`0x0055F0`). At 0 the routine sets it again from byte 0, and the filter goes to its next frame of 1,024 bytes, back to the first after the last (`0x005568` to\n`0x0055D4`). The wrap tests only that the frame starts before the data's end\n(`0x0055B0` to `0x0055B4`), so with data that is not a whole number of frames\nthe last one runs past the resource (an inference about the filters' data)."
   },
   {
    "name": "FindBoundsRect__FR4RectPc",
    "entry": 22080,
    "text": "Sets the rectangle given to the bounds of the bytes other than 0 in a 32-by-32\nimage of bytes, the right and bottom one past the last such column and row\n(`0x00566C` to `0x00570C`, `0x00573C` to `0x005750`). An image of zeros gives\nthe empty rectangle (0, 0, 0, 0) (`0x005710` to `0x005730`)."
   },
   {
    "name": "EvalCondition__FUcUc",
    "entry": 24980,
    "text": "Returns 1 when a condition byte c is true for its argument byte a, the two bytes\nof a schedule's post or of task 169, and 0 otherwise. Condition 0 is true and 1\nfalse (`0x0061B0` to `0x0061D4`). Conditions 2 and 3 test quest flag a, bit `a & 31` of long `a >> 5`\nof the flags at `data+0x181C0`, 2 for set and 3 for clear (`0x0061D8` to\n`0x006254`). From `0x20` to `0x3F` they compare a random number with a. The\nrandom number has the low `n + 1` bits of `Random`, n being the condition's low 3\nbits, or is 0 for n of 0 (`0x006264` to `0x006288`), and bits 3 and 4 pick the\ntest through the jump table at toc -5212 (`0x00628C` to `0x0062AC`), with `0x20`\nfor equal, `0x28` for at least a, `0x30` for not equal and `0x38` for less than a\n(`0x0062B0` to `0x006304`). From `0x40` to `0x7F` they test character a's flag f,\nthe low 5 bits (`0x006318`). For f under 8 it is bit f of byte 8 of the character's\nrecord and the rest bit `f - 8` of the short at `+6` (`0x006320` to `0x00639C`),\nso f from 24 up always tests 0. With bits 5 and 6 both set the answer is the\nopposite (`0x0063A0` to `0x0063B4`). From `0x80` up they compare quest value\n`c & 31`, a byte of `data+0x181A0`, with a, by bits 5 and 6, `0x80` for equal,\n`0xA0` for at least, `0xC0` for not equal and `0xE0` for less than\n(`0x0063C8` to `0x00645C`). The characters are the 512 character records of 32 bytes at `data+0x28558`. Every other condition is\nfalse."
   },
   {
    "name": "SaveLevelProps__Fs",
    "entry": 28104,
    "text": "Saves level n. First it copies the place, facing and appearance of each of the 256 first characters' props that is not free back into the character's record,\nwith the level as its zone\n(`0x006DF4` to `0x006EB0`). The props from 256 up to the last one not free go to\nresource `0x8100` plus n (`0x006EB4` to `0x006F00`), and the 256 characters'\nprops, 4,096 bytes, to `0xF306` (`0x006F08` to `0x006F1C`). Then the map's marks,\nbit `0x8000` of each square's word, go to resource `0x8200` plus n, one bit a\nsquare in rows of whole bytes, the first square in the low bit (`0x006F24` to\n`0x007040`). The routine writes the archive's table and saves the globals\n(`TCachedSegFiles::Flush`, `SaveGlobals`, `0x007050` to `0x00705C`). The search\ndown for the last prop not free has no lower bound (`0x006EC0` to `0x006EDC`),\nand the buffer for the marks comes from `NewPtr` untested (`0x006F50` to\n`0x006F5C`)."
   },
   {
    "name": "SaveGlobals__Fv",
    "entry": 28832,
    "text": "Saves the 512 character records of 32 bytes at `data+0x28558` as resource `0xF009`, 16,384 bytes, and the 2,048 bytes of rooms\nentered at the address at toc -30420 as `0xF00E` (`TCachedSegFiles::SaveSegment`,\n`0x0070A8` to `0x0070E4`), and writes the archive's table\n(`TCachedSegFiles::Flush`, `0x0070EC` to `0x0070F0`)."
   },
   {
    "name": "ChainFreeProps__FUc",
    "entry": 30800,
    "text": "Rebuilds the chain of free records among the level's props, 16-byte records from the address at toc -30268, from record 256 up, the records\nbelow being the characters' (`0x00787C` to `0x00790C`). With the argument set, the routine frees a record with bit `0x20` of its flags byte and releases its frame's heap reference (`THeapObj::DecRef`, `0x007888` to `0x0078C0`). A used egg, flags `0xC2`, becomes `0x42` again, armed (`0x0078C4` to `0x0078D4`). Each free\nrecord, flags 255, has the chain's head written into its location bits and\nbecomes the head, so the chain runs from the highest free record down\n(`0x0078D8` to `0x0078F4`). The head is at `data+0x27D44`, -1 for an empty\nchain. Then the routine drops free records at the end of the list from its count, at\nthe address at toc -30276 (`0x007914` to `0x00794C`)."
   },
   {
    "name": "DeleteProp__Fs",
    "entry": 31116,
    "text": "Deletes prop n, from 256 up to the count and not already free (`0x0079A4` to\n`0x0079D8`). It releases the prop's frame (`THeapObj::DecRef`, `0x0079DC` to\n`0x007A14`), marks the record free, flags 255, linked to the chain's head at\n`data+0x27D44` (`0x007A1C` to `0x007A54`), and removes it from the neighborhood\n(`THood::RemoveFromHood`, `0x007A58`). The routine drops the last record from the count, and any other becomes the chain's head (`0x007A60` to `0x007A88`). Then the routine deletes every prop from 256 whose holder or container is n the same way\n(`0x007A8C` to `0x007AD4`)."
   },
   {
    "name": "GetCharacterName__FsPcUc",
    "entry": 32064,
    "text": "Writes the name of character n into the buffer given. Character 1 is the hero, the\nPascal string at `+32` of the record at `data+0x60F44`, copied as a C string of at\nmost 31 characters (`strncpy`, `0x007D60` to `0x007DA4`). For any other character\nthe name is the string of the script value with `0x3000` plus n in its high half\nand 513 in its low, copied with no bound (`TInterp::VAddrToPtr`, `strcpy`,\n`0x007DD0` to `0x007E00`), when\nthe third argument is other than 0 or bit `0x80` of byte 8 of the character's record\nis 1, the records being 32 bytes each from `data+0x28558` (`0x007DAC` to\n`0x007DCC`). Otherwise, or when that string is 0, the name is the plural name of the\ncharacter's tile, the first tile of the prop type in the low 10 bits of the record's\n`+4`, from the table of shorts at `data+0x60568` (`GetTileName` with 1,\n`0x007E08` to `0x007E30`)."
   },
   {
    "name": "MovePartyBetweenLevels__Fssss",
    "entry": 32376,
    "text": "Moves the party from one zone to another, to the x and y given, for each of\nthe 256 first characters that is active, bit 0 of the short at `+6`, and in the\nparty, bit 6 of byte 8 (`0x007E94` to `0x007EC0`). A member in the first zone\nhas its prop, the prop record of the same number, set to flags `0x42`\n(`0x007EE0` to `0x007EF8`). Its location becomes the place given in the new\nzone (`0x007EFC` to `0x007F28`, `0x007FAC` to `0x007FCC`), and the routine copies the prop's location, facing and appearance from the record (`0x007F2C` to\n`0x007FA4`), with the prop's bytes 6 and 7 cleared (`0x007FD0` to\n`0x007FEC`). A member in any other zone has its prop freed, flags 255\n(`0x007FF4` to `0x008004`). The characters are the 512 character records of 32 bytes at `data+0x28558`, the props the level's props, 16-byte records from the address at toc -30268."
   },
   {
    "name": "CueCharacters__Fs",
    "entry": 32856,
    "text": "Puts the zone's characters on the level as props. For each of the 256 first\ncharacters that is active (`0x008074` to `0x008088`), one in the zone given\nhas its prop, the prop record of the same number, set to flags `0x42`, with\nthe character's location, facing and appearance (`0x0080A8` to `0x008134`),\nand any other has its prop freed, flags 255 (`0x00813C` to `0x00814C`)."
   },
   {
    "name": "SingPlur__FPcPcUc",
    "entry": 33824,
    "text": "Copies a name with its singular and plural parts, choosing by the third\nargument (`0x008424` to `0x0084B4`). The routine copies the text after a `/` only for an argument other than 0, and the text after a `\\` only for 0, each up to the next space, the space included (`0x00842C` to `0x008490`). The `/` and the `\\` are\nnot copied. The copy ends with a 0 byte."
   },
   {
    "name": "GetTileName__FsPcUcUc",
    "entry": 34020,
    "text": "Writes tile n's name into the buffer given, singular or plural by the third\nargument (`SingPlur`, `0x00862C` to `0x008654`), or an empty string for a tile with\nno name. The names are resource `0xF004` of the archive at `data+0x181FC`, loaded,\nmoved high and locked on the first call (`0x008534` to `0x00856C`), the byte at\n`data+0x15194` marking it and the handle at `data+0x15198`. Its records are a 2-byte tile number and a C string,\nread until a number above 8,192 (`0x0085A4` to `0x0085E4`), into a table of 8,193\npointers at `data+0xD190` (`0x008574` to `0x008598`). The table is then filled\nbackward, each tile without a name taking the next tile's (`0x0085E8` to\n`0x008628`), so a name covers the tiles up to its number. The routine reads the number's first byte signed (`0x0085B0`)."
   },
   {
    "name": "ColorCycle__FP8GrafPort",
    "entry": 34452,
    "text": "Does nothing (`0x008694`)."
   },
   {
    "name": "DrawPortrait__Fssss",
    "entry": 34500,
    "text": "Draws portrait n, 64 by 64, with its top left at the h and v given, in the\ntransfer mode given (`CopyBits`, `0x0087D0` to `0x0087F8`). The portrait is\nsegment `0x87FF` plus n (`TCachedSegFiles::GetSegment`, `0x008798` to `0x0087B4`),\nunpacked into the buffer of 4,096 bytes at `data+0xC190` (`LZUnpack`, `0x0087BC` to\n`0x0087C4`) and read through a copy of the pixel map record at toc -5276 with the\nbounds (0, 0, 64, 64) and a row of 64 (`0x0086CC` to `0x008790`). With no such segment the routine draws nothing (`0x0087B8`)."
   },
   {
    "name": "MyOutline__FssPCUc",
    "entry": 34876,
    "text": "Draws a string at the h and v given twice, first in white in the style 40,\noutline and condensed, and then in black and plain over it (`0x008858` to\n`0x0088D0`). It reads the port's text style, `+70` of the port, and never uses it, so the port's style stays plain."
   },
   {
    "name": "DrawInventoryIcon__FssP8PropItem",
    "entry": 35100,
    "text": "Draws a thing's picture in the 32-by-32 box at the h and v given, as an inventory\nwindow shows it, with white left out (the transfer mode 36, `CopyBits`,\n`0x008C20` to `0x008C40`). The picture is the tile of its type's first tile, from the\ntable of shorts at `data+0x60568`, plus bits 2 to 6 of byte 4. That tile's pixels\nare at the address in the table at `data+0x4C564`, and the part of it holding the\npicture is the rectangle in the table at `data+0x3C564` (`0x0089D0` to\n`0x008A40`). It first sets bit `0x4000` of the flags of the record's color table\n(`0x0089BC` to `0x0089CC`). Under the picture goes its count when\n`GetItemCount` gives more than 1, or else, when `GetItemLetter` gives more than 0,\nthe one letter `'A'` plus that number (`0x008A44` to `0x008AA0`). The text is in\nstyle 2, outlined and centered, its baseline the style's descent above the box's\nbottom (`SetText`, `StringWidth`, `MyOutline`, `0x008AAC` to `0x008AEC`). The picture sits at the box's middle across. The text's style (`SetText`) changes the port's font, style and size, and nothing sets them back (`0x008AB0`). With text it sits on the text, or at the box's\ntop when it and the text are 32 or more high together (`0x008AF0` to\n`0x008BBC`). Without text it sits at the box's middle (`0x008BC4` to `0x008C18`)."
   },
   {
    "name": "HeapCheck__FP4Zone",
    "entry": 36500,
    "text": "Returns 1 (`0x008E94`)."
   },
   {
    "name": "NoDA__Fv",
    "entry": 41812,
    "text": "Returns 1 (`0x00A354`)."
   },
   {
    "name": "InFrontOf__FP8GrafPortP8GrafPort",
    "entry": 46492,
    "text": "Returns 1 when the second window comes before the first in the window list, and 0\nwhen the first comes first or the second is not in the list (`LMGetWindowList`,\nthe next window at `+144`, `0x00B5BC` to `0x00B5F0`)."
   },
   {
    "name": "CheckAppleEventForMissingParams__FP6AEDesc",
    "entry": 49512,
    "text": "Returns 0 when the Apple event has no parameters left unread, -1708 when it has\n(`AEGetAttributePtr` with `'miss'`, `0x00C170` to `0x00C1CC`), and the Apple\nEvent Manager's error otherwise."
   },
   {
    "name": "HandleOpenDocuments",
    "entry": 49704,
    "text": "Handles the Apple event to open documents. It reads the direct parameter as a\nlist (`'----'`, `'list'`, `0x00C22C` to `0x00C278`), checks for parameters left\nunread (`0x00C27C` to `0x00C294`) and counts the items (`0x00C298` to\n`0x00C2B8`). It sets the byte at `data+0x60DFE` (`0x00C2BC` to `0x00C2C8`) and\npasses each item, as a file record, to slot 116 of the application object at `data+0x60E0C`, `TDelverApp::OpenFromFS`\n(`0x00C2D0` to `0x00C358`). It returns the last error. It leaves the list undisposed when reading an item's size fails (`0x00C2E0` to `0x00C2F8`), or when\nthe check for unread parameters or the count fails (`0x00C27C` to\n`0x00C2B8`)."
   },
   {
    "name": "HandleQuitApplication",
    "entry": 50100,
    "text": "Handles the Apple event to quit. It calls slot 124 of the application object at `data+0x60E0C`, `TDelverApp::DoQuit`,\nstores its answer at `+28` of the object, and returns 0 when that answer is other than 0 and -128, a cancel, when it is 0 (`0x00C3EC` to `0x00C420`)."
   },
   {
    "name": "HandleOpenApplication",
    "entry": 50276,
    "text": "Handles the Apple event to open the application. It sets the byte at\n`data+0x60DFE` and calls slot 120 of the application object at `data+0x60E0C`, `TDelverApp::DoStartup`, and returns 0\n(`0x00C494` to `0x00C4B8`)."
   },
   {
    "name": "HandleDisplayNotice",
    "entry": 50424,
    "text": "Handles the Display Manager's Apple event that the screens changed. For each\ndisplay in its `'dspl'` list, from the last (`0x00C52C` to `0x00C668`), it reads\nthe old configuration's rectangle (`'dddr'`) and device (`'dmdd'`) and the new\nconfiguration's rectangle (`0x00C548` to `0x00C62C`), and passes the device and\nthe two rectangles to slot 128 of the application object at `data+0x60E0C`, `TApp::DoMonitorChanged` (`0x00C634` to\n`0x00C64C`). It returns 0. The routine tests no result of the Apple Event Manager, so a missing parameter passes what the stack held, and it disposes of the list alone, never the three descriptors it reads for each display (`0x00C670`)."
   },
   {
    "name": "MyGrowZone",
    "entry": 51528,
    "text": "Frees the reserve block at `+96` of the application object at `data+0x60E0C` when memory runs out and returns its\nsize, or 0 when there is none (`0x00C978` to `0x00C9B0`). It works in the\napplication's A5 world (`SetCurrentA5`, `SetA5`)."
   },
   {
    "name": "MoveableDialogerRoutine",
    "entry": 61364,
    "text": "Filters the events of a movable modal dialog. For an update event it\ncopies the event to `+4` of the application object at `data+0x60E0C` and calls its slot 164, `TApp::HandleUpdateEvt`\n(`0x00EFF4` to `0x00F02C`). The test meant to send only other windows' updates\nthere compares the event's `what`, 6, with the dialog's address (`0x00EFE8` to\n`0x00EFF0`), which never match, so every update goes to the application, the\ndialog's among them. That changes nothing on screen, since\n`TApp::HandleUpdateEvt` passes over a window whose kind is below 8, and a\ndialog's is 2 (an inference from the Toolbox's numbers). A click in the dialog's drag bar drags it within the\nscreen's bounds, sets the item to 0 and the event to a null event, and returns 0\n(`0x00F038` to `0x00F098`). Every other event, and the updates, then go to the standard filter at `data+0x60DF8` when there is one (`CallUniversalProc`, `0x00F0A0` to `0x00F0D0`), and the routine returns its answer."
   },
   {
    "name": "MyNavEventProc",
    "entry": 65000,
    "text": "Passes an event that Navigation Services shows the game, selector 0, to the application object at `data+0x60E0C`.\nIt copies the event to `+4` of the object (`0x00FE14` to `0x00FE3C`), and an\nupdate goes to slot 164, `TApp::HandleUpdateEvt`, and anything else to slot 136,\n`TDelverApp::HandleIdle` (`0x00FE40` to `0x00FE78`)."
   },
   {
    "name": "MyNavFilterProc",
    "entry": 65208,
    "text": "Returns 1 for an item that Navigation Services is to show and 0 for one it is to\nleave out. With no list of file types,\nthe count at `data+0x60D98` or the list's address at `data+0x60D94` 0, every item\nshows (`0x00FEBC` to `0x00FEDC`). Otherwise an item that is a file, a `'fss '`\nitem whose folder byte is 0, shows only when its type is in the list (`0x00FEE4`\nto `0x00FF58`). Folders and other items show."
   },
   {
    "name": "TryAndSet__FPP7GDevices",
    "entry": 71008,
    "text": "Sets a screen to the depth given when it can show it. It records `HasDepth`'s\nanswer at `data+0x60EB8` (`0x011588` to `0x011598`). For a depth the screen has,\nit saves the screen's present mode at `data+0x60EBA` (`0x0115A8` to `0x0115C4`) and\ncalls `SetDepth` (`0x0115C8` to `0x0115CC`). On success it sets the byte at\n`data+0x60EBC` and returns 1 (`0x0115D8` to `0x0115EC`). Otherwise it returns 0."
   },
   {
    "name": "TryAMonitor__FPP7GDeviceUc",
    "entry": 71232,
    "text": "Returns 1 when a screen can show the game, and 0 otherwise. A screen under 640\nby 480 cannot (`0x011664` to `0x011698`). With bit 5 of byte 1 of the \"UI Prefs\"\nrecord set, the 256-color answer, the screen has to be 8 bits deep, and\notherwise 8 or more (`0x01169C` to `0x0116F4`). A screen that passes has its mode\nrecorded as both the game's and the one to set back (`0x011700` to `0x011724`).\nOtherwise, with the second argument set, the routine changes the depth, to 8 with bit 5,\nand without it to 16, then 32, then 8, until one works (`TryAndSet`, `0x01172C` to\n`0x01179C`). The main screen is the device at `data+0x60D78`, the game's mode is at\n`data+0x60EB8`, the mode to set back at `data+0x60EBA` and the byte for a changed\ndepth at `data+0x60EBC` (`TryAndSet`)."
   },
   {
    "name": "GetWGLoc__FP12WindowRecordRsRs",
    "entry": 71928,
    "text": "Stores a window's place on the screen through the two pointers, h then v, as\nthe negated left and top of its port's pixel map bounds (`0x0118F8` to\n`0x01191C`). The port has to be a color port."
   },
   {
    "name": "SwitchedOut__Fv",
    "entry": 72024,
    "text": "Runs as the player switches away from the game. When the game changed the\nscreen's depth, it sets the depth back with the front window kept in its place\n(`GetWGLoc`, `SetDepth`, `MoveWindow`, `0x011960` to `0x0119D0`). It sets the screen's colors back in any case (`RestoreDeviceClut`, `0x0119D8` to `0x0119E0`). The main screen is the device at `data+0x60D78`, the game's mode is at\n`data+0x60EB8`, the mode to set back at `data+0x60EBA` and the byte for a changed\ndepth at `data+0x60EBC` (`TryAndSet`)."
   },
   {
    "name": "ForceMyColors__Fv",
    "entry": 72224,
    "text": "With an object at `data+0x647B0`, and nothing otherwise (`0x011A44` to\n`0x011A4C`), shows its window, activates its palette, selects it and sends it to\nthe back (`0x011A50` to `0x011A90`). Then, when the main screen's color table and\nthe game's table at `data+0x60D6C` have the same size, it sets the game's\ntable's seed, and the long at `data+0x60D74` itself, to the screen's seed\n(`0x011A98` to `0x011B1C`), so copies to the screen need no translation of\ncolors (an inference)."
   },
   {
    "name": "SwitchedIn__Fv",
    "entry": 72544,
    "text": "Runs as the player comes back to the game. When the screen's mode is not the one\nto set back, the player having changed the depth meanwhile, it records the present mode\nas the one to set back and marks the depth as changed (`0x011BA8` to `0x011BDC`).\nThen, unless the depth was never changed and the mode is the same, it sets the\ngame's mode with the front window kept in its place (`0x011BE0` to `0x011C34`).\nThe routine forces the game's colors in any case (`ForceMyColors`, `0x011C3C`).\nThe main screen is the device at `data+0x60D78`, the game's mode is at\n`data+0x60EB8`, the mode to set back at `data+0x60EBA` and the byte for a changed\ndepth at `data+0x60EBC` (`TryAndSet`)."
   },
   {
    "name": "SwitchedAndGone__Fv",
    "entry": 72832,
    "text": "Sets the main screen back to the mode saved by `TryAndSet` when it changed the\ndepth (`0x011C84` to `0x011CB4`), and restores the screen's colors\n(`RestoreDeviceClut`, `0x011CBC` to `0x011CC4`)."
   },
   {
    "name": "NukeScratchFile__Fv",
    "entry": 72964,
    "text": "Closes the scratch archive at `data+0x181F4` when there is one\n(`TSegFile::~TSegFile`, `0x011D24` to `0x011D2C`), clears it and deletes its file,\nthe record at `data+0x19C68` (`FSpDelete`, `0x011D34` to `0x011D40`)."
   },
   {
    "name": "SameFileSpec__FP6FSSpecP6FSSpec",
    "entry": 86232,
    "text": "Returns 1 when two file records have the same volume, folder and name, and 0\notherwise (`0x0150FC` to `0x015134`). The routine compares the names byte by byte\n(`PLstrcmp`, `0x015124`), so two names that differ only in case count as\ndifferent files, though the file system treats them as one (an inference)."
   },
   {
    "name": "LoadCursors__Fv",
    "entry": 105976,
    "text": "Loads the color cursors 128 to 173 into the table at `data+0x60FF4`\n(`GetCCursor`, `0x019E00` to `0x019E3C`) and sets the present cursor's number at\n`data+0x60FF0` to -1 (`0x019E40` to `0x019E48`)."
   },
   {
    "name": "ChangeCursor__Fs",
    "entry": 106120,
    "text": "Records the cursor number given at `data+0x60FF0` and shows that cursor\nfrom the table, 0 for cursor 128 (`SetCCursor`, `0x019EC8` to `0x019ED8`). The\nnumber -1 shows QuickDraw's arrow instead, `+94` of the QuickDraw globals at toc\n-30444 (`SetCursor`, `0x019EB4` to `0x019EBC`, the globals named from their\noffsets, an inference). The number is not checked against the\ntable's 46 entries."
   },
   {
    "name": "MyInitCursor__Fs",
    "entry": 106264,
    "text": "Shows cursor n, or the cursor already set for -2 (`ChangeCursor`, `0x019F28` to\n`0x019F44`), and calls `ShowCursor` three times (`0x019F48` to `0x019F58`)."
   },
   {
    "name": "QueueUnlock__FPc",
    "entry": 106392,
    "text": "Puts an address in the first empty place of the 256-entry queue at\n`data+0x62160`, for the cache to unlock later (`0x019FC0` to `0x019FE0`). With the\nqueue full it calls `DebugStr` with \"Couldn't queue up unlock of cache data\"\n(`0x019FF4` to `0x019FF8`), and the address is not queued. Its callers are the\nsound callbacks, which run at interrupt time (an inference from their names),\nwhere no call to the cache may happen."
   },
   {
    "name": "ConsumeUnlockQueue__Fv",
    "entry": 106560,
    "text": "Unlocks each address in the queue in the cache at `data+0x181EC`\n(`TCache::Unlock`, `0x01A060` to `0x01A088`) and empties its place (`0x01A090`\nto `0x01A09C`)."
   },
   {
    "name": "GMSInit__Fv",
    "entry": 107932,
    "text": "Starts the music. It clears the tune player at `data+0x62564`, the spot tune at\n`data+0x62154`, the ambient tune at `data+0x62158` and the byte at `data+0x6215C`\nthat is 1 while music plays (`0x01A5A0` to `0x01A5DC`). With the\nComponent Manager there (`Gestalt` with `'cpnt'`, `0x01A5E0` to `0x01A5F4`) it\nopens a tune player (`OpenDefaultComponent` with `'tune'`, `0x01A604` to\n`0x01A618`). With a player it sets its time scale to 600 and the volume at\n`data+0x62560` to 8, and returns 1 (`0x01A630` to `0x01A64C`). Otherwise it\nreturns 0."
   },
   {
    "name": "GMSPause__Fv",
    "entry": 108168,
    "text": "Pauses the spot tune when there is one, and the ambient tune otherwise\n(`GMSTune::Pause`, `0x01A6A4` to `0x01A6DC`), and clears the byte for music\nplaying (`0x01A6E0` to `0x01A6E8`). It does nothing without a tune player."
   },
   {
    "name": "GMSResume__Fv",
    "entry": 108316,
    "text": "Resumes the spot tune when there is one, and the ambient tune otherwise\n(`GMSTune::Resume`, `0x01A738` to `0x01A788`), and then sets the byte for music\nplaying, which stays as it was with neither tune (`0x01A754` to `0x01A758`,\n`0x01A774` to `0x01A780`). It does nothing without a tune player."
   },
   {
    "name": "GMSSetVolume__Fs",
    "entry": 108476,
    "text": "Sets the music volume and returns the old one, or 0 without a tune player\n(`0x01A7E0` to `0x01A7F0`). A volume of 0 stops the tune, the spot when there is\none and the ambient otherwise (`0x01A7F4` to `0x01A834`), when the old volume\nwas not 0. It stores the new volume and gives one above 0 to the player, times 8,192 (`0x01A838` to `0x01A860`). Going from 0 to a volume above 0 plays\nthe spot tune or the ambient one from its start (`0x01A868` to `0x01A8BC`),\nwithout a test of the byte for music playing, so it starts the music during a pause or a halt."
   },
   {
    "name": "GMSQuit__Fv",
    "entry": 108796,
    "text": "Destroys both tunes and closes the tune player (`0x01A904` to `0x01A964`)."
   },
   {
    "name": "GMSHalt__Fv",
    "entry": 108956,
    "text": "Stops the spot tune when there is one, and the ambient tune otherwise\n(`GMSTune::Stop`, `0x01A9A0` to `0x01A9E0`), and clears the byte for music\nplaying."
   },
   {
    "name": "GMSPlaySpot__FPc",
    "entry": 109088,
    "text": "Plays a tune once, over the ambient one. Without a tune player it does nothing.\nIt sets the byte for music playing (`0x01AA4C` to `0x01AA54`). The tune already\nplaying as the spot returns at once (`0x01AA64` to `0x01AA70`). It unlocks another spot tune in the cache and destroys it (`0x01AA74` to `0x01AAA0`). For a\ntune given it makes a `GMSTune` that does not repeat, locks the tune in the\ncache, pauses the ambient tune and plays the spot (`0x01AAAC` to `0x01AB04`).\nThe allocation is not tested. A spot tune started while another plays pauses\nthe ambient tune a second time (`0x01AAEC` to `0x01AAFC`), which records the\nstopped spot tune's place as the ambient one's, so the ambient tune would later\nresume from that place (an inference from `TuneGetStatus`). For an address of 0\nit resumes the ambient tune (`0x01AB0C` to `0x01AB1C`)."
   },
   {
    "name": "GMSPlayAmbient__FPc",
    "entry": 109400,
    "text": "Sets the ambient tune, which repeats. Without a tune player it does nothing. It\nsets the byte for music playing, returns at once for the tune already set, and\nunlocks and destroys another ambient tune (`0x01AB80` to `0x01ABD4`). For a tune\ngiven it makes a repeating `GMSTune` and locks the tune in the cache\n(`0x01ABE0` to `0x01AC18`), and plays it only when no spot tune exists\n(`0x01AC20` to `0x01AC34`). An address of 0 leaves no ambient tune."
   },
   {
    "name": "GMSIdle__Fv",
    "entry": 109684,
    "text": "Runs the music between events, with a tune player and the byte for music\nplaying set (`0x01AC94` to `0x01ACAC`). With a spot tune it calls\n`GMSTune::Idle` for it (`0x01ACBC` to `0x01ACC0`) and destroys it when it has\nended (`0x01ACCC` to `0x01ACDC`), without the `TCache::Unlock` that\n`GMSPlaySpot` gives a spot tune it replaces, so the ended tune's data stays\nlocked in the cache. It then resumes the ambient tune in both cases,\nso while a spot tune still plays, the routine queues the ambient one over it in the same player (`0x01ACC8`, `0x01ACE0` to `0x01ACF0`). Without a spot tune it calls\n`GMSTune::Idle` for the ambient one, which queues it again when it has ended\n(`0x01ACF8` to `0x01AD08`)."
   },
   {
    "name": "PlayOnceCB__FllP11STSoundSpec",
    "entry": 109892,
    "text": "The sound callback of a sound that does not repeat. For the messages 1 and 2 it queues the\nsound's data for unlocking (`QueueUnlock`, `0x01AD74` to `0x01AD88`). With no sound\nit calls `DebugStr` with \"Got null soundSpec in PlayOnceCB\" (`0x01AD4C` to\n`0x01AD68`)."
   },
   {
    "name": "isqrt__Fi",
    "entry": 113716,
    "text": "Returns the whole square root of a number, the largest k with k times k not above\nit, by adding the odd numbers 3, 5, 7 and on to 1 until the sum passes the\nnumber (`0x01BC38` to `0x01BC60`). The time grows with the root. A number below 1\ngives 0. The comparison treats the numbers as signed (`0x01BC5C`), so for 2,147,395,600 (46,340\nsquared) or more the sum passes the largest long, turns negative, and the\nanswer is wrong. The routine at `0x05EFFC` of the same name has the same instructions."
   },
   {
    "name": "CalcStereo__FssRsRs",
    "entry": 113812,
    "text": "Sets the left and right volumes of a sound at (dx, dy) from the listener, each up\nto 128. The table at `data+0x6152A`, 31 rows of 31 bytes for dx and dy from -15\nto 15, comes from the first call (`0x01BCBC` to `0x01BDDC`). Entry x of row y is\n256 over the distance (`isqrt`, at least 1), times 30 less x, over 30, held to\n128. The routine clamps the distances to the table (`0x01BDE0` to `0x01BE1C`). The left\nvolume is entry dx + 15 of the row and the right entry 31 less that (`0x01BE20`\nto `0x01BE58`), one past the mirror of the left, so a sound straight ahead is a\nlittle louder on the left, and one at dx -15 reads the right from the next row's\nfirst entry, or for dy 15 from the byte after the table."
   },
   {
    "name": "__sinit_TDroppableWindow_cp",
    "entry": 174772,
    "text": "Copies the word at `data+0x77374` into `data+0x62A6C` (`0x02AAB8` to `0x02AAC4`).\nIt runs before `__sinit_THeap_cp` sets that word to the script's None, so it\ncopies 0, as `TDroppableWindow::ClearNeeds` also stores."
   },
   {
    "name": "MyMoveTo__FsssPce",
    "entry": 178020,
    "text": "Formats a string with the format and values given into the buffer at\n`data+0x62AB6` (`vsprintf`, `0x02B794` to `0x02B7AC`) and moves the pen to the\nstart of the line that the string makes at the x, with the justification in\nthe third argument, and the y in the second (`TextWidth`, `TTextContext::Justify`,\n`MoveTo`, `0x02B7B8` to `0x02B7E8`). The routine formats the string and does not draw it."
   },
   {
    "name": "MyDrawText__FlPce",
    "entry": 178220,
    "text": "Formats a string into the buffer at `data+0x62A76` (`vsprintf`, `0x02B864` to\n`0x02B874`) and draws it with a shadow at the pen, the pen's place being `+48` of\nthe port at `+202` of the QuickDraw globals at toc -30444 (named from their offsets, an inference) (`TTextContext::DrawTextOutlined`, `0x02B880` to\n`0x02B8BC`). The colors are entries of the game's color table, the text's from\nbyte n of the bytes at toc -2960, n the first argument, and the shadow's from\nbyte 0. Those bytes are 15 and then seven 255s, so color 0 draws the text and\nits shadow alike in entry 15, and colors 1 to 7 draw in 255 over an entry-15\nshadow. Nothing bounds n, and 8 or more reads past the table (`0x02B8A4` to\n`0x02B8AC`). The buffer is 64 bytes before `MyMoveTo`'s, so a longer string runs\ninto it (an inference from the two addresses)."
   },
   {
    "name": "cmpskills__FPCsPCs",
    "entry": 179044,
    "text": "Compares two props by number for a sort, returning -1, 0 or 1 as the first\nprop's type, the low 10 bits of `+4` of its record, is below, equal to or above\nthe second's (`0x02BB68` to `0x02BBDC`). The props are the records from the\naddress at toc -30268. No `bl` reaches it, so a sort receives it as its comparison."
   },
   {
    "name": "PopUpMenuSelectWithCurFont",
    "entry": 211636,
    "text": "Shows a pop-up menu in the font and size given. It saves the system font and\nsize (`0x033AE4` to `0x033AF0`), inserts the menu as a submenu (`0x033AFC` to\n`0x033B04`), sets the system font and size to those given and the last\nspacing to -1 (`0x033B0C` to `0x033B28`), and calls `PopUpMenuSelect` with the\npoint in the second argument, top then left, and the item (`0x033B30` to\n`0x033B40`). Then it sets the font back and deletes the menu (`0x033B4C` to\n`0x033B78`), and returns the choice."
   },
   {
    "name": "SpanBits__FR4RectR6PixMapssss",
    "entry": 214276,
    "text": "Fills a rectangle of the port at `+202` of the QuickDraw globals at toc -30444 (named from their offsets, an inference) with a strip of art from the\npixel map given, a left end, a repeated middle and a right end, copied with the\nmode in the last argument. The third argument is the left end's width e, the\nfourth the middle's width s, the fifth the right end's width t. The left end is\nthe art's first e columns, at the rectangle's left (`0x03453C` to\n`0x03457C`). The middle's source is the s columns after it, and its\ndestination starts e to the right and is e plus s wide (`0x034584` to\n`0x0345AC`), so `CopyBits` stretches each copy to that width. The copies step s to\nthe right while their right edge stays within the rectangle's right less t\n(`0x0345B4` to `0x034604`), which, the copies' right edges standing e past an\nunstretched copy's, stops them up to e columns early. A last part copy fills up\nto that edge, unstretched and so up to e plus s less 1 wide, its source running\npast the middle's s columns into the art after them\n(`0x034608` to `0x034668`), and the right end is the art's last t columns at the\nrectangle's right (`0x034670` to `0x0346BC`). The stretch comes from the instructions, unseen on a screen."
   },
   {
    "name": "DrawDoPopUp__FsUc",
    "entry": 224652,
    "text": "Draws status-window button n in its rectangle, entry n of the 8-byte rectangles\nat `data+0x64504` (`0x036D90` to `0x036DC8`), in the transparent mode, 36. The\nsource is the pixel map at `+300` of the record at `data+0x64618`, whose top half\nis the button as it is and whose bottom half serves for a second argument other than 0 (`0x036DCC` to `0x036E00`). The routine finds the halves by halving the bounds' bottom, so the bounds have to start at 0 (`0x036DDC` to `0x036DEC`)."
   },
   {
    "name": "DrawAMacro__FR4RectsUc",
    "entry": 226208,
    "text": "Draws macro button n in the rectangle given, in the port at `+202` of the QuickDraw globals at toc -30444 (named from their offsets, an inference). The\nbutton's frame is the pixel map at `+100` of the record at `data+0x64618`, drawn\n2 pixels larger than the rectangle in the transparent mode, 36, its top half normally and its bottom half for a third argument other than 0 (`0x0373C4` to\n`0x037440`). The macro's picture is resource `0x8A00` plus n, 32 by 16 pixels of 8\nbits, drawn into the rectangle when the archive at `data+0x181FC` has it\n(`0x03745C` to `0x0375A8`). The routine reads the picture from that one archive with `TSegFile::LoadSegment` into the buffer at `data+0x62D5C`, 512 bytes, past the\ncache (`0x037558` to `0x037574`)."
   },
   {
    "name": "__sinit_TStatusWindow_cp",
    "entry": 229008,
    "text": "Builds the 8 objects of 12 bytes at `data+0x64544`, each a `std::vector<short>`\n(the name in `sub_038014`'s traceback table), with `sub_038014`, `sub_037F60`\nbeing their destructor, and registers `__arraydtor$2299` to destroy the array at\nthe end (`construct array` and `register global destructor`, `0x037E94` to\n`0x037EC4`)."
   },
   {
    "name": "cmpprops__FPCsPCs",
    "entry": 231592,
    "text": "Compares two props by number for a sort, first by type, the low 10 bits of `+4`\nof the record (`0x0388D8` to `0x03891C`), then by facing, bits 2 to 6 of byte 4\n(`0x038920` to `0x03895C`), then by byte 6 (`0x038960` to `0x03898C`). The\nsecond test of the facing repeats the \"less than\" test instead of testing\n\"greater than\" (`0x038950` to `0x038954`), so a first prop that faces higher\ngoes on to byte 6 instead of returning 1, and comparing the two props the other\nway round can give the same answer. The props are the records from the\naddress at toc -30268."
   },
   {
    "name": "myListSearch",
    "entry": 233372,
    "text": "A search routine for the List Manager. It returns 0, a match, when the cell's\ndata and the search data are both 2 bytes long and equal as shorts, and -1\notherwise (`0x038F9C` to `0x038FD4`)."
   },
   {
    "name": "MaskSubIcon__FsssUcUc",
    "entry": 241328,
    "text": "Draws a quarter of image n, 16 by 16 pixels, at the h and v given in the\ntransparent mode, 36 (`0x03AED0` to `0x03AFE4`). The images are 32 by 32 pixels\nof 8 bits, 1,024 bytes each, from the address stored at `data+0x60564`\n(`0x03AF14`, `0x03AF80` to `0x03AF88`). The fifth argument picks the lower half\n(`0x03AF8C` to `0x03AF9C`) and the fourth the right half (`0x03AFA4` to\n`0x03AFBC`)."
   },
   {
    "name": "__dt__Q215TScriptedWindow7TWidgetFv",
    "entry": 242716,
    "text": "Sets the vtable to the widget's (`0x03B438` to `0x03B444`), and frees the object when the flag is above 0."
   },
   {
    "name": "FitText__FPCcs",
    "entry": 244020,
    "text": "Squeezes a C string into the width given, when it is wider, by setting the\nport's extra space between characters to the width less the string's, a\nnegative number, over the number of characters, in fixed point (`CharExtra`,\n`0x03B958` to `0x03B9A4`), the test at `0x03B984` to `0x03B988`. The routine leaves a narrower string as it is, and the extra space stays in the port for what comes next.\nAn empty string reaches the division by its length only for a width below 0\n(`0x03B9A0`)."
   },
   {
    "name": "__sinit_TConversation_cp",
    "entry": 272188,
    "text": "Clears the word at `data+0x647BC` (`0x042740` to `0x042748`)."
   },
   {
    "name": "ObjToMonst__Fs",
    "entry": 281184,
    "text": "Returns the entry of the 128 entries of 16 bytes at the address stored at\n`data+0x181E8` whose short at `+12` is the number given (`0x044A78` to\n`0x044AB4`). The first entry with 0 there ends the search with 0, and so does\nthe end of the table."
   },
   {
    "name": "AddToList__FP14TActiveMonster",
    "entry": 281324,
    "text": "Adds a monster to the list at `data+0x657F4`, linked through `+56` and in\norder of the word at `+0`, lowest first. The monster goes before the first\nmonster whose word is higher, so after those with the same word, or at the end\n(`0x044AFC` to `0x044B54`)."
   },
   {
    "name": "GetObjectWeight__Fsss",
    "entry": 349412,
    "text": "Returns the weight of a number of things of a prop type, the type's weight times\nthe third argument. By the prop type's long in the table at `data+0x74FA0`, which\n`FillIntfCache` fills from the classes, a type whose class's weight is not a plain number\n(bit `0x02000000`, `0x05551C` to `0x055524`) has it read from the class. The routine gives prop record 0 the type (`0x05552C` to `0x055554`), reads the class's member 36, Weight, for it (`TInterp::GetProperty`, `0x055558` to `0x055564`), and\nitem a of the result, a the second argument, is the weight (`TInterp::At`,\n`0x05556C` to `0x055578`). Prop record 0 has the type afterward. Any other\ntype's weight is its byte in the table at `data+0x74BA0`, and a type with 0\nthere weighs 0 (`0x055598` to `0x0555C0`)."
   },
   {
    "name": "SetItemCount__FP8PropItems",
    "entry": 349708,
    "text": "Sets a stack prop's count of things. By the prop type's long in the table at `data+0x74FA0`, which\n`FillIntfCache` fills from the classes, a type with bit\n`0x100` has the number in byte 7 and one with bit `0x200` in bytes 6 and 7\n(`0x055610` to `0x055648`). A type with bit `0x2000` is also given a picture by\nthe number, in bits 2 to 6 of byte 4, 0 for 1 or fewer, 1 to 3 for 2 to 4, 4 for 5\nto 9, 5 for 10 to 19, 6 for 20 to 34 and 7 for 35 or more (`0x05564C` to\n`0x055740`)."
   },
   {
    "name": "GetItemCount__FP8PropItem",
    "entry": 350076,
    "text": "Returns the number of things a prop stands for, byte 7 for a type with bit\n`0x100` of the prop type's long in the table at `data+0x74FA0`, which\n`FillIntfCache` fills from the classes, bytes 6 and 7 for one with bit `0x200`, and 1 for any other type\nor for a count of 0 (`0x055780` to `0x0557F8`)."
   },
   {
    "name": "GetItemQuality__FP8PropItem",
    "entry": 350256,
    "text": "Returns byte 6 of a prop, its quality, or 0 for a type whose count is in byte 6,\nbit `0x200` of the prop type's long in the table at `data+0x74FA0`, which\n`FillIntfCache` fills from the classes (`0x055834` to `0x055858`)."
   },
   {
    "name": "GetItemLetter__FP8PropItem",
    "entry": 350356,
    "text": "Returns byte 6 of a prop for a type with bit `0x400` of the prop type's long in the table at `data+0x74FA0`, which\n`FillIntfCache` fills from the classes, and 0 for any other\n(`0x055898` to `0x0558BC`)."
   },
   {
    "name": "GetMaxInvEncumb__Fs",
    "entry": 350456,
    "text": "Returns the most weight that a character's or a container's inventory may\nhave. For the numbers 0 to 256 it is the character's byte 9, body, times 20\n(`0x055910` to `0x05593C`), the test being \"above 256\" (`0x05591C` to\n`0x055924`), so the limit of prop 256, the first prop of a level, comes from byte 9 of character record 256, the record the game makes monsters from, in place of its member 22.\nFor anything else it is the value of member 22 of the thing's class, read with\n`TInterp::GetProperty` (`0x055944` to `0x0559A8`), or 1 when the class has no\nmember 22, the answer of `TInterp::HasProperty` being the word at\n`data+0x77374` (`0x05596C` to `0x0559B0`)."
   },
   {
    "name": "GetMaxEquEncumb__Fs",
    "entry": 350712,
    "text": "Returns how much a character can wear, byte 9, body, times 10 for the numbers\n0 to 256 (`0x0559F8` to `0x055A20`), and 1 for anything else. The test is the\nsame \"above 256\" (`0x055A00` to `0x055A08`), so prop 256's answer is character\nrecord 256's byte 9 times 10."
   },
   {
    "name": "GetCurInvEncumb__Fs",
    "entry": 350808,
    "text": "Returns the weight in a character's inventory, adding for each prop its weight, `GetObjectWeight` for its type, its picture bits 2 to 6 of byte 4 and its count from `GetItemCount`. A prop counts when\nits flags are exactly 16 and its holder, the low 12 bits of `+2`, is the character\n(`0x055A84` to `0x055AD0`). A prop with flags 8 or 9, inside another, counts when\nits chain of containers reaches the character's prop, or ends in a container with\nflags 16 and the character as its holder (`0x055AD4` to `0x055BA4`). Worn things,\nflags 24, and what is in them do not count, and neither does a prop of flags 10,\n11 or 28, or 66 with a facing of 9, which `GetPropParent` gives a holder too\n(`0x055A84` to `0x055AE8`)."
   },
   {
    "name": "GetCurEquEncumb__Fs",
    "entry": 351232,
    "text": "Returns the weight a character wears, adding its weight, `GetObjectWeight` for its type, its picture bits 2 to 6 of byte 4 and its count from `GetItemCount` for each prop with flags exactly 24\nand the character as its holder (`0x055C2C` to `0x055C74`). What is inside worn\nthings does not count."
   },
   {
    "name": "GetPropParent__Fs",
    "entry": 351440,
    "text": "Returns `GetPropParent` of prop record n for n from 256 up, and 0 for the\ncharacters' props below (`0x055CE0` to `0x055D0C`)."
   },
   {
    "name": "GetPropParent__FP8PropItem",
    "entry": 351564,
    "text": "Returns the number of the character or prop that a prop is with, the low 16 bits of its location, by\nits flags byte. Flags 16 and 24, carried and equipped, and 28 give the holder\n(`0x055D50` to `0x055D9C`), flags 8 to 11, inside another prop, give the\ncontainer (`0x055DA4` to `0x055DAC`), and flags `0x42` with a facing of 9 give\nthe same bits (`0x055DB4` to `0x055DCC`). Any other prop returns 0."
   },
   {
    "name": "FindSkill__Fss",
    "entry": 352512,
    "text": "Returns the number of the prop, from 256 up, that is a skill of the character\ngiven of the type given, flags 28 with the character as its holder and the\ntype in the low 10 bits of `+4`, or 0 when there is none (`0x056104` to\n`0x056178`). The props are the records from the address at toc -30268, and their\ncount the short at toc -30276."
   },
   {
    "name": "IsInArea__FssP8PropItem",
    "entry": 378708,
    "text": "Returns 1 when the square (x, y) given is in a prop's area, and 0 otherwise. The area has the prop's square at its center, byte 6 of the record wide and byte 7 tall.\nIts left is the prop's x less half of byte 6 plus 1, rounded toward 0, its right\nthe left plus byte 6, and the same for y with byte 7 (`0x05C768` to\n`0x05C7C0`). Both edges count as inside (`0x05C7C4` to `0x05C7F4`), so a width\nof w covers w + 1 squares."
   },
   {
    "name": "isqrt__Fi",
    "entry": 389116,
    "text": "The same as the `isqrt__Fi` at `0x01BC34`, instruction for instruction\n(`0x05F000` to `0x05F028`)."
   },
   {
    "name": "RotateTile__FPcPcss",
    "entry": 389212,
    "text": "Writes a 32-by-32 tile turned by the direction (dx, dy) into the buffer given, or\ncopies it as it is for (0, 0) (`0x05F078` to `0x05F098`). With c and s the\ndirection's two parts over its length, times 256 (`isqrt`, `0x05F0A4` to\n`0x05F100`), the pixel u right and v down from the result's middle is the source's\npixel at (u c - v s, u s + v c) from its middle, cut toward minus infinity, and 0\noutside the tile (`0x05F104` to `0x05F1F4`)."
   },
   {
    "name": "TileFlagsToColor__Fl",
    "entry": 396192,
    "text": "Returns the magic map's color number for a tile's flags. With bit `0x100` it is 1 when bit `0x200` is also 1 and 9 otherwise (`0x060BA0` to `0x060BBC`). With bit\n`0x200` alone it is 8 for either of the bits `0xC` (`0x060BC8` to `0x060BD4`), 0 when both `0x400` and `0x20` are 1 (`0x060BD8` to `0x060BEC`), and otherwise 5\nwith bit `0x20000` and 7 without (`0x060BF0` to `0x060C04`). With neither, it is\n14 for bit `0x800` (`0x060C08` to `0x060C14`), and otherwise by `flags & 0xF000`\n4 for 0, 6 for `0x3000`, 10 for `0x7000` and 2 for any other (`0x060C18` to\n`0x060C78`)."
   },
   {
    "name": "InitBalloons__Fv",
    "entry": 400024,
    "text": "Makes the eight shapes of the talk balloons, one region for each variant 0 to 7,\ninto the table at `data+0x6A8F8` (`0x061AC4` to `0x061CB8`). Each is a rounded\nrectangle 120 wide, 128 to the tail's tip, 20 high for variants 0 to 3 and 32\nfor 4 to 7 (`0x061B54` to `0x061B5C`, `0x061BC0` to `0x061BD0`), with corners of\n8 (`FrameRoundRect`, `0x061C44` to `0x061C50`) and a tail of three points (`0x061C58` to `0x061C8C`). The variant's\nbits pick the tail's points and the rectangle's shift of 8 to leave room for it\n(`0x061AEC` to `0x061C38`), and set the balloon's offset from the speaker, two\nshorts for each variant in the table at `data+0x6A8D8`."
   },
   {
    "name": "CopyLight__FPUcsPUcsPC4Rectss",
    "entry": 409088,
    "text": "Adds a rectangle of a light map, the first buffer with its row length, into a\nsecond buffer at the h and v given, byte by byte, each sum capped at 255\n(`0x063F10` to `0x063F7C`). The second buffer's row length is also its width. The routine cuts the rectangle where it would start left of or above the second buffer\n(`0x063E1C` to `0x063E38`, `0x063E78` to `0x063E94`) or run past its right or\nbottom (`0x063E3C` to `0x063E6C`, `0x063E98` to `0x063EC8`), and adds nothing when nothing remains (`0x063E70` to `0x063E74`, `0x063ECC` to `0x063ED0`)."
   },
   {
    "name": "SubLightSolid__FPUcPUll",
    "entry": 411644,
    "text": "Passes a block of 4 by 4 pixels through a table of 256 bytes, each pixel becoming\nits entry, four rows of the row length given apart (`0x064804` to\n`0x064854`)."
   },
   {
    "name": "SubLightDither__FPUcPUcPUll",
    "entry": 411792,
    "text": "Passes a block of 4 by 4 pixels through two tables of 256 bytes in a\ncheckerboard. In the first row the first and third pixels go through the second\ntable and the other two through the first, and the tables change places at each\nrow (`0x064898` to `0x0648F8`)."
   },
   {
    "name": "DoPropFX__FUcPcPc",
    "entry": 419900,
    "text": "Copies a 32-by-32 tile of 1,024 pixels with a prop's effect, its high 4 bits\npicking the effect and its low 4 bits n the strength. `0x30` dissolves the tile. Each pixel stays when the low 4 bits of a running number are n or less and becomes 0 otherwise, the number starting from the source's address divided by\n1,024 and stepping as times 21 plus 11 (`0x066884` to `0x0668D8`). `0x20`\nmoves each pixel that has bit `0x10` set and is under 208 by 16 less n within its\ncolor's run of 16, and makes it 255 when that leaves the run (`0x0668E0` to `0x066950`). `0x10`\ncopies the pixels whose low 4 bits are n or less and makes the rest 0\n(`0x066958` to `0x06699C`). Any other effect copies the tile as it is\n(`0x0669A4` to `0x0669B0`), and effect 1 then lays the pixels other than 0 of image\n389 of the 1,024-byte images from the address stored at `data+0x60564` over it\n(`0x0669B8` to `0x066A08`)."
   },
   {
    "name": "AdjustPropFX__FUc",
    "entry": 420420,
    "text": "Returns a prop's effect one step weaker, the low 4 bits lowered by 1, or 0 when\nthey are 0 already (`0x066A4C` to `0x066A5C`). An effect with its high 4 bits 0\ncomes back unchanged (`0x066A44` to `0x066A48`)."
   },
   {
    "name": "gXPos__Fs",
    "entry": 441888,
    "text": "Returns 256 less (x less 24) times 256 over 48, the division rounded toward 0\n(`0x06BE20` to `0x06BE44`). Its caller is `DrawSky`."
   },
   {
    "name": "CalcLocations__Fss",
    "entry": 441960,
    "text": "Works out where the sky's bodies are for a day d and a time t of the day's 96\n(day and time being an inference from the routine's 96d + t), and caches the answer, doing nothing when d and t are the last ones (`0x06BED4` to\n`0x06BEF0`, `0x06C074` to `0x06C078`). The last d and t are at `data+0x6CA7A`\nand `data+0x6CA76`, set to -1 by the first call, which the bytes at\n`data+0x6CA78` and `data+0x6CA74` mark (`0x06BE90` to `0x06BED0`). For each of\nthe bodies, 2 by the short at `data+0x8E00`, with a speed s, a start b and a number\nof phases c from the shorts at `data+0x8E02`, `data+0x8E0A` and `data+0x8E12`,\nit sets a place p and a phase (`0x06BEFC` to `0x06C05C`). The place before the\ntime of day is b plus (96d + t) times s over 96, taken modulo 96, and the phase\nis c less that place times c over 96, rounded to the nearest, both modulo c.\nThe place at `data+0x8E2A` is then that place plus t, modulo 96, and the phase\ngoes to `data+0x8E22`. The tables have s 4 and 20, b 48 and 36, and c 8 and 1, so\nthe first body has 8 phases and comes round in 24 days, and the second has one\nphase."
   },
   {
    "name": "GetBrightness__Fsl",
    "entry": 442540,
    "text": "Returns the daylight for a day and a time, the hour being the time shifted right\n12. It calls `CalcLocations` with the day and the time shifted right 10\n(`0x06C0D0` to `0x06C0E4`) and does not use its results. Dawn and dusk are the\nlongs at `data+0x08E34` and `data+0x08E38`, `0x5000` and `0x13000` in the image,\nhours 5 and 19. Before hour 3 the light is 0 (`0x06C0E8` to `0x06C104`). Up to hour\n8 it is twice the time over 16 past 3:00, over 16 (`0x06C108` to `0x06C13C`, and\n`0x06C19C` to `0x06C1A8`), so it reaches 159. From hour 8 to 17 it is 12,800 over\n16, 800 (`0x06C140` to `0x06C158`). Up to hour 22 it falls the same way from 160\nto 0 (`0x06C160` to `0x06C194`), and after is 0. The ramps stop at 159 and the\nplateau is 800, but `TViewer::AmbientLight` counts any level of 160 or more as\nfull light and a lower one as a fifth of it in 32 steps, so the light rises from none at\n3:00 to 31 steps of 32 at 8:00 and is then full, a change of one step."
   },
   {
    "name": "DrawSky__FR4Rectsl",
    "entry": 442872,
    "text": "Draws the sky strip of the status window for a day and a time, the quarter hour\nbeing the time shifted right 10 (`0x06C24C`). The routine works out the bodies' places first (`CalcLocations`, `0x06C250` to `0x06C258`). The sky is the rectangle filled\nwith a pattern by the hour, with cyan as the background color, so a white pattern\ngives cyan and a black one black (`BackColor` with 273, `FillRect`, `0x06C218`,\n`0x06C40C` to `0x06C41C`). The routine makes the 24 patterns on the first call, a table of pointers into the QuickDraw globals at `data+0x6CA14` marked by the byte at\n`data+0x6CA11` (`0x06C25C` to `0x06C408`). From dawn and dusk, the longs at\n`data+0x8E34` and `data+0x8E38` (hours 5 and 19), hours 0 to 2 and 22 and 23 are\nblack, 3 and 4 and 20 and 21 dark gray, 5 and 19 gray, 6 and 7 and 17 and 18 light\ngray, and 8 to 16 white. The drawing is then clipped to the rectangle and the\nbackground set to white (`0x06C424` to `0x06C434`). The sun, tile 361, goes at\nx from `gXPos` of the quarter hour and y 16 less the height for that quarter hour\nin the table of 96 at `data+0x8E3C` (`0x06C43C` to `0x06C504`). Then each of the\n2 bodies, its tile the base at `data+0x8E1A` (352 and 360) plus its phase at\n`data+0x8E22`, goes the same way at its place at `data+0x8E2A` (`0x06C530` to\n`0x06C5EC`). Each goes on with white left out (`CopyBits`, the transfer mode 36), so a body covers the sun. The clip is then set to the port's whole\nrectangle (`0x06C5F0` to `0x06C5F8`). The tiles' pixels are 1,024 bytes from the\npointer at `data+0x60564` plus 1,024 times the tile's number."
   },
   {
    "name": "__sinit_THood_cp",
    "entry": 445200,
    "text": "Makes the `THood` at `data+0x6CA7C` (`THood::THood`, `0x06CB14` to `0x06CB20`)."
   },
   {
    "name": "MyLDEF",
    "entry": 447904,
    "text": "The list definition that `TListBox`'s lists run. It finds the `TListBox` in the\nlist's user handle, `+68` of the record (`0x06D5E4` to `0x06D5F4`), and calls its\nslot 64, `LDEFDraw`, for the draw message, 1, and its slot 68, `LDEFHilite`, for\nthe highlight message, 2, with the message's arguments (`0x06D5F8` to\n`0x06D660`). The other messages, and a list with no object, do nothing."
   },
   {
    "name": "MyCDEF",
    "entry": 452408,
    "text": "The control definition that the registered `'CDEF'` resources run, with the\nvariation code, the control, the message and its parameter. Message 27 returns\n`' ok '` (`0x206F6B20`, `0x06E758` to `0x06E770`), Apple's answer for a\ndefinition that handles the new messages (the names of the messages are Apple's, an inference from\ntheir numbers matching the slots below). Message 3, a new control, makes the\ncontrol's `TCDEF` object (`TCDEFRegister::CreateController`) and stores it in the\ncontrol's data at `+28` (`0x06E774` to `0x06E798`). For the other messages, with an object, the routine locks the control's handle for the call and sets its state back after\n(`HGetState`, `HLock`, `HSetState`, `0x06E7A0` to `0x06E7D0`, `0x06EB94` to\n`0x06EB9C`), and the jump table at toc +4032 sends message 0 to slot 12, `Draw`,\nwhen the control is visible (`0x06E7F8` to `0x06E820`), 1 to slot 20, `Test`, 2 to\nslot 24 or 28 by the parameter's top bit, 4 to the destructor, 5 to slot 32,\n`Pos`, 6 to slot 36, `Thumb`, 7 to slot 40, `Drag`, with whether the parameter is\nother than 0, 8 to slot 44, `Action`, 10 and 11 to slots 24 and 28, 13 to slot\n60, `DrawGhost`, 14 to slot 68, `CalcBestRect`, 15 to slot 72, `HandleTracking`, 16\nto slot 76, `Focus`, 17 to slot 92, `KeyDown`, 18 to slot 80, `Idle`, 19 to slot\n48, `GetFeatures`, 22 to slot 84, `Activate`, 23 to slot 88, `SetUpBackground`,\nand 26 to slot 64, `CalcValueFromPos` (`0x06E82C` to `0x06EB8C`). Messages 20 and\n21 both go to slot 56, `SetData` (`0x06EABC` to `0x06EB24`), so the routine handles a request for a control's data as a change to it, and never calls slot 52, `GetData`. Every class of the game's controls has `TCDEF`'s two, which\nreturn -30581 alike, so the answer is the same. Messages 3, 9, 12, 24 and 25 do nothing. It returns the slot's\nanswer for messages 1, 7, 15, 16, 17, 19, 20 and 21, and 0 otherwise."
   },
   {
    "name": "SyncPorts__Fv",
    "entry": 456904,
    "text": "Copies the Window Manager's port's pen place, size and mode, its text settings\nfrom `+66` to `+79`, its pen pattern and its background pattern into the Window\nManager's color port (`0x06F8D8` to `0x06F94C`). It then clears the color port's\nfill pattern, `+62`, and returns the old one (`0x06F954` to `0x06F96C`). The window definition (`MyWDEF`) puts it back after, except on its early return for a window with no controller, which leaves the color port with no fill pattern."
   },
   {
    "name": "MyWDEF",
    "entry": 457132,
    "text": "The window definition that the registered `'WDEF'` resources run, with the\nvariation code, the window, the message and its parameter. Message 3, a new\nwindow, makes the window's `TWDEF` object (`TWDEFRegister::CreateController`) and\nstores it in the window's data handle at `+130` (`0x06F9C8` to `0x06F9F4`). For\nthe other messages, with an object (`0x06FA48` to `0x06FA58`), the jump table at\ntoc +4248 sends message 0 to slot 12, `Draw`, when the window is visible\n(`0x06FA7C` to `0x06FAA0`), 1 to slot 32 for the part hit (`0x06FAAC` to\n`0x06FAC8`), 2 to slot 36 with the port's rectangle in global coordinates\n(`0x06FAD0` to `0x06FB1C`), 4 to the destructor (`0x06FB28` to `0x06FB40`), 5 to\nslot 40, `Grow`, 6 to slot 44, `DrawSizeBox`, 7 to slot 48, `GetFeatures`, and 8 to\nslot 52, `GetRegion`, with the region and its code (`0x06FB4C` to `0x06FBC4`).\nMessages 0, 1, 5 and 6 run with the ports synchronized (`SyncPorts`,\n`0x06FA34` to `0x06FA44`), the color port's fill pattern and the port set back\nafter (`0x06FBD8` to `0x06FBF0`), except for a window with no object, where the\nroutine returns early (`0x06FA54` to `0x06FA58`) and leaves both as `SyncPorts`\nleft them. It returns the slot's answer for messages 1, 7\nand 8, and 0 otherwise."
   },
   {
    "name": "FrameBox__FR4RectsPUc",
    "entry": 459692,
    "text": "Draws a frame inside a rectangle, of the style given, with the Pascal title given\non its top edge (`0x0703CC` to `0x070440`). Style 8 is a thin frame from tile 413,\nits corners the tile's corners, 8 wide and 4 high (`CopyBits`, `0x070604` to\n`0x0707CC`), and its edges filled with patterns of the tile's edges between them\n(`SubTilePat`, `FillCRect`, `0x070444` to `0x0705FC`). Any other style is a frame 16\npixels deep. Its top and bottom edges are patterns of tile 416's top and bottom\nquarters, the left ones or, with bit `0x01` of the style, the right ones\n(`0x0707D8` to `0x070A58`), and its left and right edges tile 417's left and right\nquarters, the top ones or, with that bit, the bottom ones (`0x070A60` to\n`0x070B08`). The corners are tile 418's quarters (`CopyBits`, `0x070B10` to\n`0x070D74`), but with bit `0x02` the top left corner is tile 423's top left quarter,\nand with bit `0x04` the bottom right corner is tile 423's bottom right quarter\n(`0x070B60` to `0x070BA0`, `0x070C8C` to `0x070CCC`). A title goes on a tab from the\nbottom half of tile 412, 16 pixels wider than the title and centered across the top\nedge, in text style 0 (`ExpandHorizontally`, `AADrawText`, `0x070808` to `0x070914`),\nthe edge's pattern on either side of it (`0x07091C` to `0x0709A8`), and the port's\nfont, style and size go back after (`0x0709B0` to `0x0709D4`). Every copy is in the\nsource copy mode. The tiles' pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map record\nat toc -5276."
   },
   {
    "name": "HiliteGoAwayFrame__FR4RectUc",
    "entry": 462416,
    "text": "Draws a window's close box at the rectangle's top left, 16 by 16 pixels from image\n423 of the 1,024-byte images, 32 by 32 pixels of 8 bits, from the address stored at `data+0x60564`, its top left quarter, or its top right quarter for a second argument other than 0 (`0x070E58` to `0x070F38`), copied as it is into the present port\n(`CopyBits`, `0x070F40` to `0x070F68`)."
   },
   {
    "name": "SetTilePat__Fs",
    "entry": 462772,
    "text": "Returns a pixel pattern made from image 419 or 420 of the 1,024-byte images, 32 by 32 pixels of 8 bits, from the address stored at `data+0x60564`, the number given limited\nto those two (`0x070FD0` to `0x070FF4`). The routine makes the two patterns once, at `data+0x6E204` (`0x070FF8` to `0x0710C4`), with `NewPixPat`, data of 1,024 bytes and the 32-by-32 pixel map of toc -5276, whose copy over the pattern's map\n(`0x071040` to `0x0710C0`) replaces the color table `NewPixPat` made, which is\nnever freed, two handles in all. Each call copies the image into the pattern's\ndata, marks the pattern's expanded form out of date and calls `PixPatChanged`\n(`0x0710DC` to `0x07114C`)."
   },
   {
    "name": "SubTilePat__FsR4Rectss",
    "entry": 463264,
    "text": "Returns a pixel pattern made from the part of a tile inside a rectangle, its\nrows and columns turned round by the two numbers given, so a pattern laid from any\npoint lines up with the tile. The routine moves the rectangle to (0, 0), which gives the pattern's width and height (`OffsetRect`, `0x0711EC` to `0x071214`). One pattern\nserves every call, its handle at `data+0x6E200`, made on the first call (the byte at\n`data+0x6E1FC`, `0x0711C8` to `0x0711E8`, and `NewPixPat`, `0x07121C` to\n`0x071230`). The routine resizes its data to width times height (`SetHandleSize`, `0x071234` to `0x071250`), and sets its pixel map to the record at toc -5276 with\nthe bounds, a row of the width and the buffer of 1,024 bytes at `data+0x6DDFC`\n(`0x071258` to `0x071370`). The source is tile n's pixels from the rectangle's top\nleft (`0x071374` to `0x0713AC`). The routine masks the numbers by the width less 1 and the height less 1 (`0x0713A4` to `0x0713A8`), which makes them a remainder only for a\nwidth and height that are powers of two. Each row of the tile goes to the buffer's\nrow (i + the second number) modulo the height, moved right by the first number\nwith its end brought round to the start (`BlockMove`, `0x0713B4` to `0x071498`).\nEvery call copies the record over the pattern's whole map, its color table too, so the one `NewPixPat` made goes missing (`0x071308` to `0x071370`), and\nthe rectangle's size is not tested against the buffer's 1,024 bytes.\nThe buffer then becomes the pattern's data, and the routine marks the pattern as changed and returns it (`0x0714AC` to `0x071500`). The tile's pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map\nrecord at toc -5276."
   },
   {
    "name": "SubTilePat__FsUcUcss",
    "entry": 464188,
    "text": "Returns a pixel pattern made from a quarter of a tile, 16 by 16, its rows and\ncolumns turned round by the two numbers given, as the other `SubTilePat` does. The\nsecond argument, when set, picks the left half and the third the top half, 0\npicking the right or bottom (`0x0716DC` to `0x071734`). One pattern serves every\ncall, its handle at `data+0x6DDF8`, made on the first call (the byte at\n`data+0x6DDF4`, `0x071560` to `0x071588`), and only then given a data handle of\n256 bytes and its pixel map, the bounds (0, 0, 16, 16), a row of 16 and the\nbuffer at `data+0x6DCF4` (`0x07158C` to `0x0716CC`). The routine reduces the two numbers modulo 16 (`0x0716E0` to `0x0716E8`). The routine copies the 16 rows, turned round, into the buffer (`BlockMove`, `0x071744` to `0x071828`), makes the buffer the pattern's data, marks the pattern as changed and returns it (`0x07182C` to\n`0x071874`). The tile's pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map\nrecord at toc -5276."
   },
   {
    "name": "DrawCheck__FR4RectPUc12eButtonStates",
    "entry": 465068,
    "text": "Draws a check or radio button, a 16-by-16 box and its label, in the current port.\nThe box is a quarter of the tile given, picked by the state, 0 the top left, 1 the\nbottom right, 2 the bottom left, 3 the top right, and any other state the top left\n(`OffsetRect`, `0x0718CC` and `0x071968` to `0x0719C8`). It goes at the\nrectangle's left, its middle at the rectangle's middle height, drawn with white\nleft out (the transfer mode 36, `CopyBits`, `0x0719D0` to `0x071A40`). The label\nfollows in text style 0, in state 2 in the dark gray at `data+0x0910E` (red, green\nand blue each `0x4000`) (`SetText`, `RGBForeColor`, `0x071A80` to\n`0x071AA8`), 18 pixels in from the left and with the font's ascent split across the\nmiddle (`MoveTo`, `AADrawText`, `0x071AB0` to `0x071B00`). The color is then black, and the routine sets the port's font, style and size back (`0x071A48` to `0x071A7C`,\n`0x071B08` to `0x071B38`). The tile's pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map\nrecord at toc -5276."
   },
   {
    "name": "ExpandHorizontally__FR4Rects",
    "entry": 465804,
    "text": "Draws a button's face across a rectangle from a tile, its height stretched or cut\nto fit. The tile's columns 0 to 7 go at the left (`0x071C30` to `0x071C6C`), its\ncolumns 8 to 23 repeat, 16 pixels at a time, until a copy starts within 16 of the\nright (`0x071DA8` to `0x071F34`), and its columns 16 to 31 go at the right\n(`SetRect`, `0x071F38` to `0x071F6C`), each with the source copy mode (`CopyBits`).\nIn a rectangle 32 or more high `CopyBits` stretches the 32 rows to its height\n(`0x071D78` to `0x071DA0`). A lower one has its top half drawn from the tile's\ntop rows and its bottom half from the bottom rows, each at their size, so the middle rows go missing (`0x071C84` to `0x071D6C`). The routine places the bottom half from the middle down by the top half's height (`0x071CC4` to `0x071D3C`), so for an odd height the rectangle's last row stays undrawn. The tile's pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map\nrecord at toc -5276."
   },
   {
    "name": "DrawButton__FR4RectPUc12eButtonState",
    "entry": 467184,
    "text": "Draws a button in a rectangle, its face tile 424 plus the state given across the\nrectangle (`ExpandHorizontally`, `0x072138` to `0x072140`), so the states 0 to 3 are\ntiles 424 to 427, and its Pascal title centered on it when there is one. The title is\nin text style 1 in a rectangle lower than 32 pixels and style 0 otherwise\n(`SetText`, `0x07217C` to `0x0721A4`), centered across the rectangle and by the\nstyle's ascent down it (`StringWidth`, `MoveTo`, `AADrawText`, `0x0721C4` to\n`0x072260`), and in state 2 in the dark gray at `data+0x0911C`, red, green and blue\neach `0x4000` (`RGBForeColor`, `0x0721CC` to `0x0721F0`). The color is black again\nafter, and the port's font, style and size go back to what they were (`0x07214C` to\n`0x072178`, `0x072268` to `0x072298`). State 4 flashes the button, state 3 for 8\nticks and then state 0 (`Delay`, `0x0720FC` to `0x072134`). The tiles' pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map record\nat toc -5276."
   },
   {
    "name": "DrawNumberField__FR4Rectss",
    "entry": 467692,
    "text": "Draws a number field, the number given on the face of tile 415, the state -9 of\n`DrawButton` (`NumToString`, `0x07233C` to `0x072358`). With a part other than -1\nthe face leaves 16 pixels on the right for the arrows (`0x07230C` to `0x072338`),\nwhich fill them, 16 by 32 from tile 429's left columns (`0x072368` to `0x072458`).\nFor part 20 the up arrow, the top half, comes from tile 430 instead, pressed, and for\npart 21 the down arrow does (`0x072464` to `0x0725F8`). Each copy is in the source\ncopy mode (`CopyBits`). A part other than -1, 0, 20 and 21 narrows the face but\ndraws no arrows (`0x072338`, `0x072534` to `0x07253C`). The tiles' pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map record\nat toc -5276."
   },
   {
    "name": "FindNumberFieldPart__FR4Rect5Point",
    "entry": 468556,
    "text": "Returns the part of a number field at a point, 0 outside the field's rectangle or\nleft of its 16 rightmost pixels (`0x072664` to `0x0726A0`). In those 16 pixels it\nreturns 20 above the field's middle and 21 below it (`0x0726A4` to\n`0x0726CC`)."
   },
   {
    "name": "Bevel__FRC4Rects",
    "entry": 468764,
    "text": "Draws a raised edge of the depth given inside a rectangle, a white line on the\nleft and top and a black one on the right and bottom for each pixel of depth,\nthe rectangle shrinking by 1 each time (`0x072778` to `0x072818`). The lines blend half and half with what is there (`OpColor` with 32,768 for each of red,\ngreen and blue, and the mode 32, `0x072728` to `0x07276C`). The routine sets the pen back to normal after (`0x07281C`), and leaves the color black for a depth above 0, the loop alone changing the colors (`0x072778`, `0x0727C4`)."
   },
   {
    "name": "DeBevel__FRC4Rects",
    "entry": 469084,
    "text": "Draws a sunken edge, as `Bevel` does with the colors the other way round, black\non the left and top and white on the right and bottom (`0x0728B8` to\n`0x072958`), and sets the color back to black and the pen to normal after\n(`0x07295C` to `0x072968`)."
   },
   {
    "name": "ExpandHorizontally__FR4RectsUc",
    "entry": 469420,
    "text": "Draws a bar 16 pixels high across a rectangle's top from a tile, its top half\nwith the third argument set and its bottom half with it 0 (`0x0729E0` to\n`0x072A74`). The\ntile's columns 0 to 15 go at the left (`0x072A78` to `0x072AF0`), its columns 8 to\n23 repeat, 16 pixels at a time, starting 16 in, until a copy starts within 16 of\nthe right (`0x072AF8` to `0x072B8C`), and its columns 16 to 31 go at the right\n(`0x072B90` to `0x072BFC`), each with the source copy mode (`CopyBits`). The tile's pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map\nrecord at toc -5276."
   },
   {
    "name": "DrawBottomTab__FRC4RectRC4RectPCUcUc",
    "entry": 470092,
    "text": "Draws one of the tabs at the bottom of the character window, with its label. A\nline along the area's top runs from its left to the tab and from the tab to its\nright (`MoveTo`, `LineTo`, `0x072C70` to `0x072C90`, `0x072F2C` to `0x072F48`).\nThe tab is tile 408 for a fourth argument other than 0, the chosen tab, and tile 409 otherwise (`0x072CB0` and `0x072D38` to `0x072D44`). Its left corner is the tile's\ntop left quarter (`0x072D48` to `0x072DA0`), its middle the bottom half of the tile,\n32 pixels at a time, and its right corner the top right quarter, at the tab's top\n(`0x072DA8` to `0x072F24`). The routine draws the corners and the last, cut piece of the middle with white left out (the transfer mode 36), the whole pieces of the middle\nwith the source copy mode. The label goes in text style 1, centered, 4 pixels above\nthe tab's bottom (`SetText`, `StringWidth`, `AADrawText`, `0x072F84` to\n`0x072FD4`), and the routine sets the port's font, style and size back (`0x072F50` to `0x072F80`, `0x072FDC` to `0x073000`). The tile's pixels are 1,024 bytes from the pointer at `data+0x60564` plus 1,024\ntimes the tile's number, 32 bytes a row, read through a copy of the pixel map\nrecord at toc -5276."
   },
   {
    "name": "DelverDialogerRoutine",
    "entry": 471132,
    "text": "Filters the events of the game's modal dialogs, with the dialog, the event and\nthe item hit. For an update event the event is first copied to `+4` of the\napplication object at `data+0x60E0C` and its slot 164, `TApp::HandleUpdateEvt`,\ncalled (`0x073084` to `0x0730C8`). The test meant to send there only the\nupdates of other windows compares the event's `what`, 6, with the dialog's address, as\n`MoveableDialogerRoutine` does, so every update goes there (`0x073084` to\n`0x07308C`). The dialog is then drawn on parchment, its background and its\nwhole rectangle the pattern of tile 420 (`SetTilePat`, `BackPixPat`,\n`FillCRect`, `0x0730D0` to `0x073118`), its items over it and the rectangle\nmarked as drawn (`DrawDialog`, `ValidRect`, `0x073120` to `0x073130`). A raised edge 3 deep frames the default item, the short at `data+0x090FC` (1), 5 pixels outside its rectangle (`GetDialogItem`, `InsetRect`, `Bevel`, `0x073138` to\n`0x073174`). It returns 0 for an update. For a key, Escape picks item 2, Return\nand Enter the default item, and Command-period item 2 (`0x0731A8` to\n`0x073200`). The routine looks for any other key in the dialog's title, a list of keys\nfor items 1 on with a semicolon between items, `oO;qQ;nN;lL` in `'DLOG'` 128\n(`GetWTitle`, `0x07320C` to `0x073268`). The search stops one character\nbefore the title's end (`0x07325C` to `0x073268`), so the last key in a title\nnever picks its item. A key that picks an item has it stored as the item hit, its\ncontrol drawn pressed for 8 ticks (`HiliteControl` with 10 and then 0, `Delay`,\n`0x073274` to `0x0732D0`), and returns 1. Every other event returns 0. The keys\nneed no modifier, so any character in the title picks its item, in an alert\nwith a text field too (an inference about which alerts have one)."
   },
   {
    "name": "CloneControl__FPP13ControlRecords",
    "entry": 471840,
    "text": "Returns a new control in the control's window, with its rectangle, title, visibility, value, minimum, maximum, reference and action\nroutine, and the definition given (`0x073334` to `0x0733E4`). The old control stays as it is."
   },
   {
    "name": "DrawControlInPort__FPP13ControlRecordP8GrafPort",
    "entry": 472120,
    "text": "Draws a control into the port given, making the port its owner for the drawing and\nsetting the owner back after, or drawing it as it is when the port is its window\n(`Draw1Control`, `0x073458` to `0x073490`)."
   },
   {
    "name": "DrawTEInPort__FPC4RectPP5TERecP8GrafPort",
    "entry": 472308,
    "text": "Draws a text edit record's text within the rectangle given into the port given,\nmaking the port the record's port, `+82` of the record, for the drawing and\nsetting it back after (`TEUpdate`, `0x07351C` to `0x07355C`)."
   },
   {
    "name": "FaceADialog__FP8GrafPort",
    "entry": 472508,
    "text": "Dresses a dialog in the game's look. It sets the dialog's text to style 0 and its background to the pattern of tile 420, the parchment (`SetText`, `SetTilePat`, `BackPixPat`,\n`0x0735DC` to `0x073614`). The routine replaces each item that is a control with a copy of the game's kind with the item's place and state (`CloneControl`,\n`SetDialogItem`, `DisposeControl`), a button by control 16,000, the push button\nof `'CDEF'` 1000, a check box by 16,001 and a radio button by 16,002\n(`CountDITL`, `GetDialogItem`, `0x07361C` to `0x07373C`). The test leaves out the item type's bit `0x80`, the disabled bit (`0x073654`)."
   },
   {
    "name": "ExactMatchRoutine",
    "entry": 472972,
    "text": "A color search routine. It compares the first byte at its second argument with\nthe word at `+6` of the record that the present device's reference, `+26` of the\ndevice, points to, and returns 0 when they are equal and 1 otherwise\n(`0x0737A4` to `0x0737D0`). Nothing installs it. The interface's setup (`InitInterface`) stores its routine descriptor at `data+0x6DCEC`, no instruction reads that place again, and\nthe program does not import `AddSearch`."
   },
   {
    "name": "CalcRect__FP4RectP4RectP4Rectd",
    "entry": 473340,
    "text": "Sets the first rectangle to the place a fraction of the way from the second to\nthe third, each side being the second's plus the fraction times the difference,\ncut toward 0 (`0x0738FC` to `0x073A08`)."
   },
   {
    "name": "GetFullPort__Fv",
    "entry": 473668,
    "text": "Returns a port of the whole screen, the record at `data+0x6DC78`, opened on the\nfirst call (`OpenPort`, `0x073A4C` to `0x073A94`). The byte at `data+0x6DCE4`\nmarks the first call, and the port's address goes to `data+0x6DCE8`. Opening the port (`OpenPort`) makes it current, and both callers (`ZoomRect` and\n`TInventoryWindow::RandomPlace`) call this routine before saving the port, so\non the first call of a run they save the full-screen port and leave it current\nwhen they finish."
   },
   {
    "name": "ZoomRect__FR4RectR4RectUc",
    "entry": 473816,
    "text": "Draws the zoom of a rectangle, 14 outlines in gray in the exclusive-or mode on\nthe whole screen, one a tick, each erased 4 outlines later (`0x073B04` to\n`0x073C10`). The outlines are at fractions of the way from the first rectangle to\nthe second (`CalcRect`), a start divided by a step before each outline\n(`0x073BA0`). The start is 0.7 to the 15th (`0x073B40` to `0x073B60`). With the\nthird argument set the step is 0.7 (`0x073B6C`, `0x073B80`), so the fractions\ngrow from 0.7 to the 14th up to 0.7. With it 0 the start is 1 less 0.7 to the\n15th and the step 1 over 0.7 (`0x073B70` to `0x073B78`), so they fall from about\n0.697 to about 0.007. So neither way reaches the second rectangle, the largest\nfraction being 0.7."
   },
   {
    "name": "LoadPixs__FPUcssR6PixMap",
    "entry": 474508,
    "text": "Makes a pixel map of the width and height given from a packed picture. The\nbounds are (0, 0, width, height), the rows the width rounded up to 4 bytes with the\npixel map bit set (`0x073DA0` to `0x073DE8`), and the pixels a new block of rows\ntimes height, decompressed into (`NewPtr`, `LZUnpack`, `0x073DEC` to `0x073E28`). It\nreturns 0, or the Memory Manager's error when the block cannot be had."
   },
   {
    "name": "PixMapToPixPat__FR6PixMap",
    "entry": 474740,
    "text": "Returns a new pixel pattern with a copy of the pixel map given and its pixels\n(`NewPixPat`, `0x073EA0`). The routine makes the data width times height bytes\n(`0x073E88` to `0x073EC0`), the map's record copied into the pattern's map\n(`0x073EC8` to `0x073F44`), which replaces the color table `NewPixPat` made, never\nfreed, with the given map's, and that many bytes copied from the map's pixels\n(`BlockMove`, `0x073F48` to `0x073F5C`), so the map has to be 8 bits deep with rows\nexactly as long as it is wide. The routine marks the pattern's expanded form out of date and calls `PixPatChanged` (`0x073F64` to `0x073F74`)."
   },
   {
    "name": "MyPMToRegion__FR6PixMapPP9MacRegion",
    "entry": 475072,
    "text": "Sets a region to the outline of a pixel map's shape. It makes a bitmap the size of the map, each pixel other than 0 setting its bit (`NewPtrClear`, `0x073FD8` to\n`0x074104`), and a failed allocation throws `bad_alloc` (`0x074034` to `0x074060`).\nA second bitmap receives the shape with its enclosed holes filled (`CalcMask`, `0x074108` to `0x074188`), the routine frees the first, and it makes the region from the second (`BitMapToRegion`, `0x07418C` to `0x0741B8`). It returns the Memory\nManager's error when the second bitmap cannot be had, and otherwise the region's\nresult, with the message \"BitMap to region failed\" to the debugger for an error\n(`DebugStr`, `0x07412C` to `0x0741D4`)."
   },
   {
    "name": "ClipLine__FRsRsRsRsR4Rect",
    "entry": 477828,
    "text": "Cuts a line from (x1, y1) to (x2, y2) to a rectangle, and returns 1 when some of it\nis inside and 0 when none is. Each end has a code, 8 left of the rectangle, 4 at or\npast its right, 1 above it and 2 at or below its bottom (`0x074A8C` to\n`0x074B5C`). With both codes 0 it returns 1, and with a side in both codes it returns 0\n(`0x074B60` to `0x074B8C`). Otherwise the routine moves the end outside, the first end when both are, along the line to the side, the bottom's last row, the top, the right's\nlast column or the left in that order, the other coordinate found by proportion,\ncut toward 0 (`0x074B90` to `0x074CD0`, `0x074D44` to `0x074E7C`), and its code\nworked out again (`0x074CD4` to `0x074D40`, `0x074E80` to `0x074EEC`). The routine changes the ends in place."
   },
   {
    "name": "IsOneGammaAvailable",
    "entry": 479012,
    "text": "Returns 1 when a screen can have a gamma table set for it alone, and 0\notherwise (the meaning an inference from the name). It\nreturns 0 when the trap `0xAA29` is not there, its address being that of the\nunimplemented trap `0xA89F` (`NGetTrapAddress`, `0x074F2C` to `0x074F70`), when the\ndevice has both attributes 13 and 14 (`TestDeviceAttribute`, `0x074F78` to\n`0x074FA8`), and for a device of type 1 (`0x074FB0` to `0x074FC0`)."
   },
   {
    "name": "GetDevGammaTable",
    "entry": 480576,
    "text": "Reads a screen's gamma table into the pointer given, which is 0 first\n(`0x07556C`), by a status call to the screen's driver with code 8 (`PBStatusSync`,\n`0x0755A4` to `0x0755C0`), Apple's `cscGetGamma` (an inference from the number).\nIt returns -1 when `IsOneGammaAvailable` returns 0, the Memory Manager's error when\nthe 50-byte parameter block cannot be had, and otherwise the driver's result\n(`0x075570` to `0x0755D8`)."
   },
   {
    "name": "SetDevGammaTable",
    "entry": 480800,
    "text": "Gives a screen the gamma table given, by a control call to its driver with code 4\n(`PBControlSync`, `0x075670` to `0x075690`), Apple's `cscSetGamma` (an inference).\nOn success it sets the screen's colors again from its color table, so the new gamma shows (`SetEntries`, `0x0756A4` to `0x0756EC`). It returns as\n`GetDevGammaTable` does."
   },
   {
    "name": "LZUnpack__FPUcPUc",
    "entry": 481084,
    "text": "Decompresses a Delver graphic into the buffer given, one code byte at a time,\nuntil a code from `0xF8` up (`0x07573C` to `0x07576C`). The codes are these.\nBelow `0x80` a code is 2 bytes, b and c. It copies `(c >> 3) & 3` bytes as they\nare (`0x075888` to `0x0758B4`) and then `(c & 7) + 3` bytes from the output,\nstarting `((c >> 5) << 7 | (b & 0x7F)) + 1` bytes back (`0x0758B8` to\n`0x0758F0`). From `0x80` to `0xBF` a code is 3 bytes, b, c and d. It copies\n`d & 3` bytes as they are and then `(c & 31) + 3` from\n`((d >> 2) << 9 | (c >> 5) << 6 | (b & 0x3F)) + 1` bytes back (`0x075810` to\n`0x075880`). The copies run forward a byte at a time, so a copy that overlaps\nwhat it writes repeats it. From `0xC0` to `0xCF` the next `((b & 15) + 1) * 4`\nbytes go out as they are, and from `0xD0` to `0xDF` the next `b & 15`\n(`0x0757D0` to `0x075808`). From `0xE0` to `0xEF` the next byte goes out `(b & 15) + 3` times (`0x0757A0` to `0x0757C8`), and from `0xF0` to `0xF7` the byte after the next goes out the next byte plus 3 times (`0x075770` to\n`0x075798`). Every code from `0xF8` to `0xFF` ends the graphic (`0x075768` to\n`0x07576C`). The output has no bound."
   },
   {
    "name": "SetText__Fs",
    "entry": 481568,
    "text": "Sets the port's font, size and style from text style n, 4 bytes at `data+0x6E21C` plus 4n, with the size in byte 0, the style in byte 1 and the font in\nthe short at byte 2 (`0x075928` to `0x07597C`)."
   },
   {
    "name": "LoadFontInfo__Fv",
    "entry": 481720,
    "text": "Fills the 23 text styles at `data+0x6E21C` from the `'TxSt'` resources 128 to 150,\nthe font found by the name from byte 2 (`GetFNum`), the size from byte 0 and the\nstyle from byte 1 (`0x0759D8` to `0x075A58`). A missing resource gives font 1 at\n12 points, plain (`0x075A60` to `0x075A94`). For each style it also stores its font\ninformation, 8 bytes at `data+0x6E278` plus 8n, setting the port's text to it and\nback (`SetText`, `GetFontInfo`, `0x075A98` to `0x075B0C`)."
   },
   {
    "name": "AADrawText__FPcss",
    "entry": 482136,
    "text": "Draws text with `DrawText`, from the offset given for the length given\n(`0x075B64` to `0x075B7C`). Nothing in it smooths the text."
   },
   {
    "name": "__sinit_TToDo_cp",
    "entry": 489960,
    "text": "Builds the 256 to-do entries of 8 bytes at `data+0x6E334` with\n`TToDo::ToDoEntry::ToDoEntry` (`construct array`, `0x0779EC` to `0x077A08`)."
   },
   {
    "name": "__ct__Q25TToDo9ToDoEntryFv",
    "entry": 490052,
    "text": "Clears the entry's word at `+4` (`0x077A44` to `0x077A48`)."
   },
   {
    "name": "HandleMapping__FPcRl",
    "entry": 527288,
    "text": "Removes each `^` from a C string, in place, and makes the next letter from `a` to\n`z` a capital (`0x080BC4` to `0x080C4C`). A `^` sets bit 0 of the flag\nthrough the pointer given, and the next character clears the flag's word, so a `^` at the end of one string makes the first letter of the next\ncall's string a capital. While the flag is other than 0 with bit 0 clear, the routine drops each character (`0x080BFC` to `0x080C04`). The string ends with a 0 byte."
   },
   {
    "name": "RangeIter__FP5VAddr",
    "entry": 539816,
    "text": "The iterator over a range, from the third argument up to the fourth less 1. An iterator's first argument is its state, two words that `TInterp::VAddrToPtr`\ngives, and its second is the step. Step 0 starts the walk and returns the first\nvalue, 1 returns True when the walk is over and False while it is not, and 2 moves on and\nreturns the next value. Any other step, 3 or more or below 0, returns None. True, False and None are the\nwords at `data+0x77370`, `data+0x7736C` and `data+0x77374` (`TInterp`).\nThe start sets the state to the two ends and returns the first (`0x083CFC` to\n`0x083D10`), the end test compares the present value with the end (`0x083D18` to\n`0x083D40`), and the next step adds 1 and returns it (`0x083D48` to\n`0x083D58`). The tests of the step are at `0x083CD8` to `0x083CF8`. The routine compares and counts the ends as whole words (`0x083D20`, `0x083D4C`), not as the\nscript's 28-bit numbers, so a range from a negative start, whose word has its\ntop bits clear, to an end of 0 or more is over before its first value."
   },
   {
    "name": "EachIter__FP5VAddr",
    "entry": 540080,
    "text": "The iterator over the items of a list, the third argument. The start sets the\nstate to None and 0 (`0x083E00` to `0x083E14`). A value whose type bits, the top\n4, are 0 comes back as it is, with the state left None (`0x083E18` to\n`0x083E2C`), and so does None for an empty list (`0x083E30` to `0x083E4C`).\nOtherwise the state is the list and the routine returns the first item (`TInterp::At`,\n`0x083E50` to `0x083E68`). The walk is over when the state is None (`0x083E70` to\n`0x083E98`). The next step adds 1 to the index and returns that item, or sets\nthe state to None and returns None past the end (`TInterp::Len`, `0x083EA0` to\n`0x083EEC`)."
   },
   {
    "name": "__sinit_DSInterp2_cp",
    "entry": 540972,
    "text": "Builds the 1,024 addresses of 4 bytes at `data+0x71750` with the `VAddr`\nconstructor at `0x08418C` (`construct array`, `0x084130` to `0x08414C`)."
   },
   {
    "name": "FocusRoutine__Q215TScriptedWindow7TWidgetFs",
    "entry": 550732,
    "text": "Returns 0 (`0x08674C`)."
   },
   {
    "name": "WantsFocus__Q215TScriptedWindow7TWidgetFv",
    "entry": 551480,
    "text": "Returns 0 (`0x086A38`)."
   },
   {
    "name": "__ct__Q215TScriptedWindow7TWidgetFP15TScriptedWindowssss",
    "entry": 554420,
    "text": "Makes a widget of the window given at h and v, of the width and height given\n(`0x0875BC` to `0x08761C`). A widget of a scripted window has its vtable at `+0`, three script values at\n`+4`, `+8` and `+12` (fields 56, 57 and 58), its rectangle at `+16`, four keys as\nshorts at `+24` and its window at `+32`. Its vtable's slots are 12 the destructor,\n16 `WantsFocus`, 20 `IsPoint`, 24 `MouseRoutine`, 28 `CursorRoutine`, 32\n`KeyRoutine`, 36 `FocusRoutine`, 40 `Flash`, 44 `PointToProp`, 48 `PropToPoint`,\n52 `CanDrop`, 56 `HiliteDrop`, 60 `UnhiliteDrop`, 64 `DoDrop`, 68 `RebuildInv`,\n72 `RenumberParent`, 76 `RenumberChild`, 80 `DispatchWidgetMethod`, 84 `GetField`,\n88 `SetField` and 92 `Marshal`. Its first value is the window's object, `0x40000000`\nwith the window's number at `+16` (`0x087624` to `0x08763C`), the second the\nscript's \"nothing\", the word at `data+0x77374` (`0x08762C`, `0x087640` to\n`0x087644`), and it clears the keys (`0x08764C` to `0x08766C`)."
   },
   {
    "name": "IsPoint__Q215TScriptedWindow7TWidgetF5Point",
    "entry": 554708,
    "text": "Returns 1 when the point is in the widget's rectangle and 0 otherwise (`PtInRect`, `0x0876E8` to `0x08770C`)."
   },
   {
    "name": "CursorRoutine__Q215TScriptedWindow7TWidgetF5Point",
    "entry": 554848,
    "text": "Returns 0 (`0x087760`)."
   },
   {
    "name": "MouseRoutine__Q215TScriptedWindow7TWidgetF5Point",
    "entry": 554924,
    "text": "When the window's byte at `+44` is other than 0, calls the window's slot 72 with the\nclick's place from the event at `+4` of the application object at\n`data+0x60E0C` and returns 1 (`0x0877C0` to `0x0877F0`). Otherwise it returns\n0."
   },
   {
    "name": "KeyRoutine__Q215TScriptedWindow7TWidgetFs",
    "entry": 555092,
    "text": "Makes a capital letter small (`0x087870` to `0x08788C`) and, when it is one of\nthe widget's four keys, calls slot 40, `Flash` (`0x087898` to `0x0878C4`)."
   },
   {
    "name": "Flash__Q215TScriptedWindow7TWidgetFv",
    "entry": 555320,
    "text": "Does nothing (`0x087938`)."
   },
   {
    "name": "PointToProp__Q215TScriptedWindow7TWidgetF5Point",
    "entry": 555380,
    "text": "Returns 0 (`0x087974`)."
   },
   {
    "name": "PropToPoint__Q215TScriptedWindow7TWidgetFsP5Point",
    "entry": 555456,
    "text": "Returns 0 (`0x0879C0`)."
   },
   {
    "name": "HiliteDrop__Q215TScriptedWindow7TWidgetFs5Point",
    "entry": 555648,
    "text": "Does nothing (`0x087A80`)."
   },
   {
    "name": "UnhiliteDrop__Q215TScriptedWindow7TWidgetFs5Point",
    "entry": 555720,
    "text": "Does nothing (`0x087AC8`)."
   },
   {
    "name": "DoDrop__Q215TScriptedWindow7TWidgetFs5Point",
    "entry": 555792,
    "text": "Does nothing (`0x087B10`)."
   },
   {
    "name": "RebuildInv__Q215TScriptedWindow7TWidgetFv",
    "entry": 555860,
    "text": "Does nothing (`0x087B54`)."
   },
   {
    "name": "RenumberParent__Q215TScriptedWindow7TWidgetFss",
    "entry": 555924,
    "text": "Does nothing (`0x087B94`)."
   },
   {
    "name": "RenumberChild__Q215TScriptedWindow7TWidgetFss",
    "entry": 555996,
    "text": "Does nothing (`0x087BDC`)."
   },
   {
    "name": "DispatchWidgetMethod__Q215TScriptedWindow7TWidgetFssP5VAddr",
    "entry": 556064,
    "text": "Returns the script's \"nothing\", the word at `data+0x77374` (`0x087C20` to `0x087C28`)."
   },
   {
    "name": "GetField__Q215TScriptedWindow7TWidgetFs",
    "entry": 556160,
    "text": "Gives a widget's script field n through the pointer given. Fields 56, 57 and 58\nare the three values at `+4`, `+8` and `+12` (`0x087CA0` to `0x087CE8`), field 59 is\nthe object of the widget's window, at `+32` (`TScriptedWindow::FindScriptedWindow`,\n`0x087CEC` to `0x087D00`), and any other field is the script's \"nothing\", the word at\n`data+0x77374` (`0x087D08` to `0x087D10`)."
   },
   {
    "name": "SetField__Q215TScriptedWindow7TWidgetFs5VAddr",
    "entry": 556396,
    "text": "Sets field 56, 57 or 58 to the value given, the words at `+4`, `+8` and `+12`\n(`0x087D6C` to `0x087DB0`). The routine leaves any other field alone."
   },
   {
    "name": "VAddrToStr__F5VAddr",
    "entry": 557824,
    "text": "Returns the C string that a script value points to, or `\"???\"` for a value that\nis not a string, one whose first byte is `0x80` or more (`TInterp::VAddrToPtr`,\n`0x088320` to `0x08837C`). A value that `VAddrToPtr` throws on also gives `\"???\"`,\nthrough the handler at `0x088364`. The `0x80` test is on the text's first\nbyte, so a real string that starts with an accented letter or a curly quote\nalso gives `\"???\"`. Whether any script's string starts so is not traced."
   },
   {
    "name": "IsPixelHit__FR6PixMapss5Point",
    "entry": 569508,
    "text": "Returns 1 when the point, less the h and v given, falls on a pixel other than 0 of\nthe pixel map, and 0 outside the map or on a 0 pixel (`0x08B0A8` to\n`0x08B134`). The routine counts the map's bounds from 0."
   },
   {
    "name": "Marshal__Q215TScriptedWindow7TWidgetFP7TStream",
    "entry": 587632,
    "text": "Writes the widget to a stream with the formats `\"llhhhh\"` and `\"hhhh\"`, its first\ntwo values, its rectangle as left, top, right and bottom, and its four keys\n(`TStream::WriteData`, slot 40, `0x08F784` to `0x08F7EC`)."
   },
   {
    "name": "__ct__Q215TScriptedWindow7TWidgetFP7TStream",
    "entry": 587856,
    "text": "Makes a widget from a stream, the reverse of `Marshal`, the values and the\nrectangle with `\"llhhhh\"` and the keys with `\"hhhh\"` (`TStream::ReadData`, slot\n44, `0x08F85C` to `0x08F8E8`). The third value is 0, and the window is the word at\n`data+0x72794` (`0x08F8AC` to `0x08F8B4`)."
   },
   {
    "name": "ObjIDToSegmentID__FsUs",
    "entry": 595872,
    "text": "Returns the segment of a script object, `0x1000` plus 32 times its kind plus a\nnumber (`0x0917F4` to `0x0917FC`). For kinds 0 and 80 the number is the prop's\ntype, the low 10 bits of `+4` of prop record n (`0x0917C8` to `0x0917DC`). For\nkind 64 it is n, or 0 when n is above 256 (`0x0917E4` to `0x0917F0`), and for any\nother kind it is n. So kind 64, the characters, gives the conversations from\n`0x1800`. The bound lets 256 through, which gives kind 72's number for 0, and no bound limits any other kind's number."
   },
   {
    "name": "SysObjToString__Fss",
    "entry": 597212,
    "text": "Returns \"System Object\" (`0x091CDC`)."
   },
   {
    "name": "SetGlobal__Fs5VAddr",
    "entry": 604764,
    "text": "Sets a global from a script. Global 12 goes to the short at toc +8560, held to 0\nto 100 (`0x093A8C` to `0x093ABC`), and global 14 to the short that toc -30092\npoints to (`0x093AC4` to `0x093AD8`). The routine leaves every other global alone (`0x093A60` to `0x093A88`). The two are the scripts' Karma and LanguagesKnown."
   },
   {
    "name": "GetGlobStr__Fs",
    "entry": 605408,
    "text": "Returns global string n. String 1 is the time of day, by the hour, the long at\ntoc -5224 shifted right 12 (`0x093D3C` to `0x093D44`), \"night\" before 4 and from\n22, \"morning\" from 4 to 11, and \"evening\" from 12 to 21 (`0x093D48` to\n`0x093D84`). The test for \"afternoon\" comes after the test of 12, under which\nthe hour is never below 6 (`0x093D60` to `0x093D7C`), so \"afternoon\" is never\nreturned. String 2 is the player's name, the Pascal string at `+32` of the\nrecord at `data+0x60F44`, copied as a C string of at most 31 characters into the\nbuffer at `data+0x7629C` (`0x093D90` to `0x093DC8`). String 10 is the string at\n`data+0x72752` (`0x093D88`), and every other string is `\"???\"`\n(`0x093DD0`)."
   },
   {
    "name": "cbHeartBeat__FP5VAddr",
    "entry": 606708,
    "text": "Adds its argument to byte 18 of the present character's record, the character\nbeing the short at `data+0x19C66` (`0x0941F4` to `0x094220`), and returns the script's \"nothing\", the word at `data+0x77374`. A callback's arguments are script values through the pointer given, 28-bit signed numbers in the low bits of each word, and its value goes back through the first argument."
   },
   {
    "name": "cbanimatetiles__FP5VAddr",
    "entry": 606988,
    "text": "Makes tile a animate through c tiles from tile b, a power of 2, in the 8 frames\nof the tile table at `data+0x4C564`, frame i showing tile `b + (i & (c - 1))`\n(`0x094364` to `0x0943B4`). The routine masks the tile numbers with `0x9FF` (`0x094334`,\n`0x094354`, `0x094390`), which clears bits `0x200` and `0x400`, so of the 2,560\ntiles those from 512 to 2,047 fold onto lower numbers (600 onto 88). No shipped\nscript makes this call (`0xA5`). Their\npictures are the 1,024-byte images from the address stored at `data+0x60564`. The routine reads the fourth argument and masks it to its low 3 bits (`0x094350`), and then sets the register to 1 (`0x09435C`), so it changes nothing. It returns the script's \"nothing\", the word at `data+0x77374`."
   },
   {
    "name": "cbsetmap__FP5VAddr",
    "entry": 608540,
    "text": "Does nothing and returns the script's \"nothing\", the word at `data+0x77374` (`0x09491C` to `0x094924`)."
   },
   {
    "name": "cbgetmap__FP5VAddr",
    "entry": 608596,
    "text": "Returns the map's tile word at (x, y), from the map that `data+0x2C55C` points\nto, a short a square in rows of the width (`0x0949C0` to `0x0949E8`). The width\nand height are at `+0x20C1C` and `+0x20C1E` of the record that `data+0x6A8C0`\npoints to, and a square outside them gives 255 (`0x094958` to `0x0949BC`)."
   },
   {
    "name": "cbrnd__FP5VAddr",
    "entry": 609212,
    "text": "Returns a random number from a to b less 1, a plus `Random`'s value modulo b less\na (`0x094C14` to `0x094C44`), or a when a is not below b (`0x094BF4` to\n`0x094C0C`). The modulo treats `Random`'s value, widened with its sign, as unsigned\n(`0x094C24` to `0x094C2C`), so a negative value counts as 2 to the 32nd less its\nsize, which tilts the result slightly for a range that does not divide that\nnumber."
   },
   {
    "name": "cbpartychar__FP5VAddr",
    "entry": 611356,
    "text": "Returns a party member as a character object, `0x4040` in the high half and the character in the low. With a second argument of 1 it is the member in\nplace n of the party, the shorts at `data+0x19C54` with their count at `data+0x19C64` (`0x095448` to `0x095484`), n not tested against the count, so a\nplace past it gives whatever short is there. Otherwise it is the nth member that is\nactive, bit 0 of the short at `+6` of its record, counted from 0 (`0x09548C` to\n`0x095504`), or None when there are fewer (`0x095508` to `0x095510`)."
   },
   {
    "name": "cbwhosaid__FP5VAddr",
    "entry": 612208,
    "text": "Returns None (`0x095770` to `0x095778`)."
   },
   {
    "name": "cbnearby__FP5VAddr",
    "entry": 613312,
    "text": "Answers whether a thing or a person is in sight of the current character, the\nshort at `data+0x19C66`, whose square is in its record in the table of 32-byte\ncharacter records at `data+0x28558` (`0x095BC4` to `0x095BFC`). The argument is a\nthing, a word `0x4000nnnn` or a number of 256 or more, or a person, a word\n`0x4040nnnn` or a number under 256 (`0x095C00` to `0x095C74`, `0x095E0C` to\n`0x095E8C`). Anything else gives None (`0x09601C` to `0x096024`). For a thing\nthe square is the one in its prop record, 16 bytes each from the pointer at\n`data+0x27D50` (`0x095C78` to `0x095CEC`), and for a person the one in its\ncharacter record, False when the person is in another zone, the top byte of the\nrecords' first long (`0x095E90` to `0x095F20`). A square is in sight when it is within the viewer's half-width, the short at `+2`\nof the viewer at `data+0x6A8C0`, of the current character across and down, and its\nbyte in the viewer's sight map at `+0xC0C8`, a row of the width at `+4`, has either\nof its low 2 bits set (`0x095CF0` to `0x095D70`,\n`0x095F28` to `0x095FA8`). Out of sight gives False. In sight, a thing gives True\n(`0x095D7C` to `0x095D84`, `0x095DF0` to `0x095DF8`), and a person, or a thing\nunder 256, gives True unless the person's byte 22 is 145, asleep, or bit `0x4000` of the short at `+6` is 1, which give False (`0x095D88` to `0x095DE8`,\n`0x095FB4` to `0x096008`). The answer goes to the slot given. The routine reads a thing's square from its record with no test of its flags, so for a carried or contained thing it reads the holder's number as a square, and a thing has no zone test,\nwhile a person has one."
   },
   {
    "name": "cbAllProps__FP5VAddr",
    "entry": 618624,
    "text": "The iterator over the level's props, each as a prop object, `0x4000` in the high\nhalf and the prop's number in the low. The start sets the index to 0 and the\nend to the count of props, the short at `data+0x27D4E`, and returns prop 256\n(`0x0970D0` to `0x09711C`). The walk is over when the index reaches the end\n(`0x097124` to `0x09714C`), and the next step adds 1 to the index and returns\nthat prop (`0x097154` to `0x097190`). So the walk gives prop 256 and then props\n1 up to the last, prop 256 twice and the characters' props 1 to 255 among\nthem."
   },
   {
    "name": "cbInParty__FP5VAddr",
    "entry": 619960,
    "text": "The iterator over the party, the shorts at `data+0x19C54` with their count at `data+0x19C64`, each member as a character object, `0x4040` in the high half and the character in the low (`0x097618` to `0x097678`). The start\nsets the state's index to -1 and its second word to the third argument, and goes\non as the next step does, so it returns the first member (`0x097608` to\n`0x097614`). The walk is over when the index reaches the count (`0x097680` to\n`0x0976AC`), and past the count the next step returns None (`0x097628` to\n`0x097644`)."
   },
   {
    "name": "cbPropsAt__FP5VAddr",
    "entry": 620284,
    "text": "The iterator over the props on the square (x, y), the third and fourth arguments.\nThe start sets the index to 0 and packs x and y into the state's second word\n(`0x097784` to `0x0977B4`), and goes on as the next step does, which adds 1 to\nthe index and then looks from there for a prop on the map, with none of the bits\n`0x1A` of its flags, at the square (`0x0977B8` to `0x097830`). The walk starts at\nprop 1, and the characters' props, flags `0x42` from `CueCharacters`, fail the\ntest of `0x1A`. The walk is over when the index reaches the count of props, the short at\n`data+0x27D4E`, and the next step returns None past the end. A prop comes back as a\nprop object, `0x4000` in the high half and its number in the low. The iterators' steps are under the range iterator, `RangeIter`."
   },
   {
    "name": "cbInRange__FP5VAddr",
    "entry": 620784,
    "text": "The iterator over the props within a distance r of the square (x, y), the third\nto fifth arguments. The start sets the index to 0 and packs r, x and y into the\nstate's second word, r in the top 8 bits and x and y in 12 bits each (`0x097978`\nto `0x0979BC`), and goes on as the next step does, which adds 1 to the index and\nlooks from there (`0x0979C0` to `0x097AB4`). A prop qualifies when its flags have\nnone of the bits `0x1A`, or are exactly 2 (`0x0979FC` to `0x097A10`), and the\nsquare of its distance, dx times dx plus dy times dy, is r times r or less\n(`0x097A14` to `0x097A98`). A distance r above 127 or below -128 does not fit the 8\nbits. The walk is over when the index reaches the count of props, the short at\n`data+0x27D4E`, and the next step returns None past the end. A prop comes back as a\nprop object, `0x4000` in the high half and its number in the low. The iterators' steps are under the range iterator, `RangeIter`."
   },
   {
    "name": "cbPropsOf__FP5VAddr",
    "entry": 621400,
    "text": "The iterator over the props of a type, the third argument. The start sets the\nindex to 255 and the type in the state (`0x097BE0` to `0x097BF4`), and goes on as\nthe next step does, which adds 1 and looks from there for a prop whose type, the\nlow 10 bits of `+4`, is the one given (`0x097BF8` to `0x097C44`). So the walk starts\nat prop 256, past the characters' props. The walk is over when the index reaches the count of props, the short at\n`data+0x27D4E`, and the next step returns None past the end. A prop comes back as a\nprop object, `0x4000` in the high half and its number in the low. The iterators' steps are under the range iterator, `RangeIter`."
   },
   {
    "name": "cbAreaOfEffect__FP5VAddr",
    "entry": 622300,
    "text": "The iterator over the characters marked in the 512 bytes at `data+0x75FA8`, each\nas a character object, `0x4040` in the high half and the number in the low. The\nstart sets the index to -1 and goes on as the next step does, which adds 1 and\nlooks from there for a byte other than 0 (`0x097F30` to `0x097F9C`). The walk is\nover at 512 (`0x097FB0` to `0x097FD4`), and past it the next step returns None\n(`0x097FA0` to `0x097FA8`)."
   },
   {
    "name": "cbSetZoneName__FP5VAddr",
    "entry": 626040,
    "text": "Sets the title of the window of the object at `data+0x657D4` to a script string,\nwhen there are both (`SetWTitle`, `0x098DDC` to `0x098E04`), and returns None. The routine makes the string a Pascal string in a buffer of 256 bytes on the stack, its length\nbyte being `strlen`'s answer cut to 8 bits and its bytes copied by `strcpy`\n(`0x098DB4` to `0x098DD4`), so a string of more than 255 characters runs past\nthe buffer."
   },
   {
    "name": "cbGetQV__FP5VAddr",
    "entry": 626608,
    "text": "Returns quest value n, byte n from `data+0x181A0` (`0x098FB4` to `0x098FC8`), with no bound on n."
   },
   {
    "name": "cbSetQV__FP5VAddr",
    "entry": 626680,
    "text": "Sets quest value n, byte n from `data+0x181A0` to the low 8 bits of the second argument and returns None (`0x098FF8` to `0x099020`)."
   },
   {
    "name": "cbGetQF__FP5VAddr",
    "entry": 626764,
    "text": "Returns True when quest flag n is 1 and False when it is 0, n being in the quest flags, bit `n & 31` of long `n >> 5` from `data+0x181C0` (`0x09904C` to `0x0990A0`)."
   },
   {
    "name": "cbSetQF__FP5VAddr",
    "entry": 626892,
    "text": "Sets quest flag n of the quest flags, bit `n & 31` of long `n >> 5` from `data+0x181C0` when the second argument is true and clears it otherwise (`TInterp::IsTrue`, `0x0990EC` to `0x099168`), and returns None."
   },
   {
    "name": "cbNext__FP5VAddr",
    "entry": 629168,
    "text": "Returns the next prop after the one given that has the same holder or container,\nby `GetPropParent`, skipping free records, or None after the last (`0x0999DC` to\n`0x099A74`). The answer has the high half of the object given. An object whose high\nhalf has any of its low 12 bits set returns None (`0x0999CC` to\n`0x0999D8`)."
   },
   {
    "name": "cbFadeFX__FP5VAddr",
    "entry": 629424,
    "text": "Stores its argument in the short at `+0x20C28` of the record that `data+0x6A8C0`\npoints to (`0x099AB0` to `0x099AD0`), and returns None."
   },
   {
    "name": "cbBeginCutScene__FP5VAddr",
    "entry": 631348,
    "text": "Starts a cutscene, when none is running, the window at `data+0x75FA4` being 0\n(`0x09A25C` to `0x09A264`). It opens a plain window titled \"Cutscene\" over the whole\nmain screen, in front of every other (`NewCWindow` with the definition 2,\n`0x09A278` to `0x09A2BC`), fills it with black (`0x09A2C0` to `0x09A2DC`), clears the\nbyte at `data+0x75FA0` (`0x09A2E4` to `0x09A2EC`) and hides the pointer\n(`0x09A2FC`). It returns None."
   },
   {
    "name": "cbEndCutScene__FP5VAddr",
    "entry": 631636,
    "text": "Ends a cutscene when one is running. It hides and disposes of its window, has the\napplication redraw every window (slot 64, `TApp::RedrawAllNow`), clears the\nwindow's word and shows the pointer again (`0x09A37C` to `0x09A3B4`). It returns\nNone."
   },
   {
    "name": "cbGetSkill__FP5VAddr",
    "entry": 633620,
    "text": "Returns a character's skill of a type, the prop from `FindSkill`, as an object\nwith `0x4050` in the high half, or None when the character has none (`0x09AB2C`\nto `0x09AB94`)."
   },
   {
    "name": "cbGetNamedProxy__FP5VAddr",
    "entry": 633936,
    "text": "Returns None (`0x09AC50` to `0x09AC58`)."
   },
   {
    "name": "cbGetNamedProp__FP5VAddr",
    "entry": 633996,
    "text": "Returns the first prop, from prop 0, whose bytes 8 and 9, its slot in the frame\ntable, are the number given, as a prop object, or None when none is (`0x09AC90` to\n`0x09AD08`)."
   },
   {
    "name": "cbNewUniqueName__FP5VAddr",
    "entry": 634176,
    "text": "Returns the counter, the short at toc +8564, and adds 1 to it (`0x09AD44` to\n`0x09AD5C`)."
   },
   {
    "name": "cbEnableAutoMap__FP5VAddr",
    "entry": 634260,
    "text": "Turns the automap on or off by its argument, byte 13 of the record that\n`data+0x6A8C0` points to, and returns whether it was on before, True or False\n(`TInterp::IsTrue`, `0x09ADB0` to `0x09ADF0`)."
   },
   {
    "name": "cbDebugStr__FP5VAddr",
    "entry": 635180,
    "text": "Does nothing and returns None (`0x09B12C` to `0x09B134`)."
   },
   {
    "name": "FillIntfCache__Fv",
    "entry": 635236,
    "text": "Fills the cache of what each of the 1,024 prop types' classes has, read once at\nthe start (`0x09B184` to `0x09B7B0`). For each type the long in the table at `data+0x74FA0`,\nthe bytes at `data+0x74BA0`, `data+0x747A0` and `data+0x73BA0` and the short at `data+0x73FA0` all become 0 (`0x09B184` to `0x09B1D8`). The routine sets prop 0's type to the type and reads the class's members for the thing `0x40000000`, prop 0, one by one (`TInterp::HasProperty`, `TInterp::GetProperty`, `0x09B1DC` to\n`0x09B200`), a member being present when the answer is other than None. Member 39\nsets the long's bits from its value's bits, 0x01 to 0x20 as they are, 0x40 as\n0x80, 0x80 as 0x40, 0x200 as `0x04000000` and 0x800 as `0x08000000` (`0x09B208` to\n`0x09B360`). Member 36 sets `0x00100000`, and with a value that is a plain number\nputs it in the byte at `data+0x74BA0`, or with any other value sets `0x02000000`\n(`0x09B364` to `0x09B424`). Member 37 sets `0x00200000` (`0x09B428` to\n`0x09B45C`). Member 55 sets `0x00400000` and puts its value in the byte at\n`data+0x73BA0` (`0x09B460` to `0x09B4D4`). Members 38, 58 and 35 set `0x00800000`,\n`0x01000000` and `0x00080000` (`0x09B4D8` to `0x09B57C`). Member 40 sets the\nlong's bits from its value's, 0x01 as 0x100, 0x02 as 0x200, 0x04 as 0x400, 0x08\nas 0x1000, 0x10 as 0x800, 0x20 as 0x2000 and 0x40 as 0x4000 (`0x09B580` to\n`0x09B698`). Member 34 puts its value plus 1 in the byte at `data+0x747A0`\n(`0x09B69C` to `0x09B700`). Member 21 sets `0x00010000` (`0x09B704` to `0x09B738`),\nand member 59 puts its value in the short at `data+0x73FA0` (`0x09B73C` to\n`0x09B7A0`). Prop 0 has the type 1,023 afterward."
   },
   {
    "name": "CalcChecksum__FPCvUl",
    "entry": 636908,
    "text": "Returns 0 (`0x09B7EC`)."
   },
   {
    "name": "CheckForForks",
    "entry": 639156,
    "text": "Sets the two bytes given to whether a file has a data fork and a resource fork,\neach 1 when that fork's length is not 0 (`PBHGetFInfoSync`, `0x09C0C8` to\n`0x09C144`). The File Manager's result is not checked, so a missing file gives\nwhatever the record has."
   },
   {
    "name": "GetDesktopFileName",
    "entry": 641396,
    "text": "Finds the Finder's desktop file in the volume's root folder, the first file of\ntype `'FNDR'` and creator `'ERIK'`, by reading the information of each file in turn from 1\n(`PBHGetFInfoSync`, `0x09C9B4` to `0x09CA14`), its name going into the buffer\ngiven. It returns 0 when it finds the file and the File Manager's error when the\nfiles run out."
   },
   {
    "name": "InitOffscreenFX__Fv",
    "entry": 643044,
    "text": "Makes the two offscreen worlds the work areas draw in, each 544 by 544 at 8\nbits a pixel, with the color table at `data+0x60D6C` (`SetRect`, `NewGWorld`,\n`0x09D020` to `0x09D048`, `0x09D170` to `0x09D18C`), and throws `bad_alloc` when\none cannot be had (`0x09D050` to `0x09D074`, `0x09D194` to `0x09D1B8`). The first\nis at `data+0x76308`, its pixel map at `data+0x76300`, its pixels' address at\n`data+0x762F8` and its row length at `data+0x762F0`. The second is at\n`data+0x76304`, with `data+0x762FC`, `data+0x762F4` and `data+0x762EC`. For each\nit locks the pixels, sets bit `0x4000` of the color table's flags and gives it the\npalette at `data+0x60D68` (`LockPixels`, `SetPalette`, `0x09D07C` to `0x09D0C4`,\n`0x09D1C0` to `0x09D208`), stores the address and the row length (`0x09D0E8` to\n`0x09D124`, `0x09D22C` to `0x09D268`) and fills it with black (`FillRect`,\n`0x09D128` to `0x09D168`, `0x09D26C` to `0x09D2AC`). The routine sets the color table's seed to the long at `data+0x60D74` for the first world (`0x09D0CC` to `0x09D0E4`), and\nthe second world's block sets the first's seed again (`0x09D210` to `0x09D228`),\nso the second world's seed is the one `NewGWorld` gave it."
   },
   {
    "name": "ResetWorkAllocater__Fv",
    "entry": 643824,
    "text": "Empties the two offscreen work worlds, filled up to 544 by 544 pixels, the first and second at\n`data+0x76308` and `data+0x76304`, with the area in use at `data+0x762E8`, the\nnext place's top at `data+0x762E4`, the shelf's bottom at `data+0x762E6` and the\nnext place's left at `data+0x762E2`, starting again at the first area (`0x09D2F8` to `0x09D344`). The routine fills each world with black over its whole port (`FillRect` with QuickDraw's black,\n`0x09D34C` to `0x09D42C`)."
   },
   {
    "name": "AllocateWorkArea__Fss",
    "entry": 644220,
    "text": "Finds a place w wide and h tall, the second and third arguments, in the two offscreen work worlds, filled up to 544 by 544 pixels, the first and second at\n`data+0x76308` and `data+0x76304`, with the area in use at `data+0x762E8`, the\nnext place's top at `data+0x762E4`, the shelf's bottom at `data+0x762E6` and the\nnext place's left at `data+0x762E2`, and\nwrites the world and the rectangle into the record given (`0x09D5A0` to\n`0x09D5B0`). Places go left to right along a shelf, and a place that would run\npast 544 starts a new shelf below the last at the left (`0x09D4A0` to `0x09D524`),\nor, past the bottom too, the next area from the top left (`0x09D4E0` to\n`0x09D50C`). The first area is the first world, and every later area is the second\n(`0x09D570` to `0x09D59C`), so a third area draws over what the second\nhad."
   },
   {
    "name": "bitwidth__Fl",
    "entry": 646116,
    "text": "Returns how many bits a number needs, by shifting it right one bit at a time\nuntil it is 0 (`0x09DBE8` to `0x09DC00`). The shift copies the sign bit in, so a negative\nnumber never reaches 0 and the loop does not end."
   },
   {
    "name": "DisposeSlider",
    "entry": 651652,
    "text": "Frees a slider, when one exists, and lowers the count of sliders at `data+0x76314`\n(`0x09F1A0` to `0x09F1C0`). When the count is 0 it disposes of the color icon at\n`data+0x76310` that the sliders share (`0x09F1C4` to `0x09F1F0`). The routine lowers the count only for a slider other than 0."
   },
   {
    "name": "GetSliderValue",
    "entry": 652488,
    "text": "Returns the slider's value, the short at `+4` (`0x09F4C8`)."
   },
   {
    "name": "CalcSliderRect",
    "entry": 655576,
    "text": "Sets a slider's track to a strip 5 pixels tall, from 8 in at each side, from 9\nto 4 pixels above its rectangle's middle, the 10 coming off before the halving (`0x0A00E8` to `0x0A015C`). A slider's record has its minimum at `+0`, its maximum at `+2`, its value at\n`+4`, its rectangle at `+16`, its thumb's rectangle at `+32` and its track's at\n`+40`."
   },
   {
    "name": "CalcThumbRect",
    "entry": 655776,
    "text": "Sets a slider's thumb to a square of 16, its left at the rectangle's left plus 3\nplus the width less 22 times the value's place in the range (`0x0A01B8` to\n`0x0A023C`). A slider whose maximum is its minimum divides by 0 (`0x0A01FC`)."
   },
   {
    "name": "CalcMouseValue",
    "entry": 655996,
    "text": "Returns the slider value at a point, or the value in the third argument for a point\noutside the slider (`0x0A0294` to `0x0A02B0`). Inside, the value is the minimum plus\nthe range times the point's distance from the left plus 10, plus half a step, over\nthe width less 22, held to the range (`0x0A02B4` to `0x0A0344`)."
   },
   {
    "name": "MyNewGWorld",
    "entry": 656260,
    "text": "Returns a new offscreen world of the rectangle and device given, or 0, with no\ncolor table (`0x0A03EC`, `0x0A03F8`). Its depth is the one given, 8 at most\n(`0x0A03C8` to `0x0A03E8`), and its flags 4 and, with a device, 2 as well\n(`0x0A0398` to `0x0A03D0`), Apple's `useTempMem` and `noNewDevice` (an inference\nfrom the numbers). The routine disposes of a world that fails, or has no pixel map or no pixels, and returns 0 (`0x0A0404` to `0x0A0468`)."
   },
   {
    "name": "MyCopyGWorld",
    "entry": 656560,
    "text": "Copies a rectangle of one offscreen world into another, through the destination's\nclip region at `+28` (`CopyBits`, `0x0A05AC` to `0x0A05C4`). For a source of 4 bits or more the routine sets the colors to black and white for the copy and back after\n(`0x0A052C` to `0x0A0580`, `0x0A05DC` to `0x0A05F4`). The routine locks the source's pixels when the low 3 bits of `GetPixelsState`'s answer are 0, and sets their state back after (`0x0A0588` to `0x0A05D4`). Apple's locked bit is `0x80`, so the\ntest always passes and the source is always locked, harmlessly (an inference\nfrom Apple's numbers). The destination is never locked. The routine does nothing when either world is 0."
   },
   {
    "name": "InstallConsole",
    "entry": 671292,
    "text": "Returns 0 (`0x0A3E3C`)."
   },
   {
    "name": "RemoveConsole",
    "entry": 671336,
    "text": "Does nothing (`0x0A3E68`)."
   },
   {
    "name": "WriteCharsToConsole",
    "entry": 671372,
    "text": "Returns 0 (`0x0A3E8C`)."
   },
   {
    "name": "ReadCharsFromConsole",
    "entry": 671420,
    "text": "Returns 0 (`0x0A3EBC`)."
   },
   {
    "name": "TryDrawContent__FP12WindowRecord",
    "entry": 671468,
    "text": "Does nothing (`0x0A3EEC`)."
   },
   {
    "name": "MyMenuDef",
    "entry": 688992,
    "text": "The menu definition of `'MDEF'` 128. It sets bit `0x4000` of the flags of the color\ntable of the pixel map record at toc -5276 (`0x0A8360` to `0x0A83E8`) and returns\nfor every message without drawing or choosing anything (`0x0A83EC` to\n`0x0A840C`)."
   },
   {
    "name": "InitCustomDefs__Fv",
    "entry": 689208,
    "text": "Readies the game's control, window and menu definitions. It registers the `'CDEF'` resources 1000, 1001 and 1002 with the mask 7, so the low 3 bits of the\nvariation code pick the class, 1000 for push buttons (0), check buttons (1) and\nradio buttons (2), 1001 for scroll bars (0) and progress bars (1), and 1002 for\neditable numbers (0) and numbers (1) (`0x0A8444` to `0x0A8568`). It registers the `'WDEF'` resources 1000, 1003, 1001 and 1002 with the mask 0, any variation,\nfor `TBorderWDEF`, `TThinBorderWDEF`, `TPixsWDEF` and `TDrawerWDEF` (`0x0A8570` to\n`0x0A8668`). The `'MDEF'` 128, or a new handle of 6 bytes when it is missing,\nbecomes an unpurgeable 68K jump to a routine descriptor for `MyMenuDef`, made\nonce (`0x0A8670` to `0x0A8710`)."
   },
   {
    "name": "SLDisable",
    "entry": 695052,
    "text": "Does nothing (`0x0A9B0C`)."
   },
   {
    "name": "SLEnable",
    "entry": 695084,
    "text": "Does nothing (`0x0A9B2C`)."
   },
   {
    "name": "__ct__Q29THeapDict12mappingentryFv",
    "entry": 697416,
    "text": "Clears the entry's word at `+4` (`0x0AA448` to `0x0AA44C`)."
   },
   {
    "name": "__sinit_THeap_cp",
    "entry": 704932,
    "text": "Sets the script's constants, None to `0x5000FFFF`, True to `0x50000001` and\nFalse to `0x50000000` at `data+0x77374`, `data+0x77370` and `data+0x7736C`, and the\nword at `data+0x77378` to `0x5000FFFE` (`0x0AC1A8` to `0x0AC1EC`)."
   },
   {
    "name": "InstallMenuHook__Fv",
    "entry": 705592,
    "text": "Installs `MyMenuHook` as the Menu Manager's hook, once, the byte at\n`data+0x77384` marking it installed (`0x0AC440` to `0x0AC4A4`). The routine makes the routine descriptor on the first call and stores it at `data+0x7737C`, and saves the old hook at `data+0x77380`."
   },
   {
    "name": "RemoveMenuHook__Fv",
    "entry": 705764,
    "text": "Puts the saved menu hook back and clears the byte, when the hook is in place (`0x0AC4E8` to `0x0AC518`)."
   },
   {
    "name": "CheckCanUsePseudoMouse__Fv",
    "entry": 705876,
    "text": "Clears the byte at `data+0x773B8` (`0x0AC554` to `0x0AC55C`)."
   },
   {
    "name": "EnablePseudoMouse__Fv",
    "entry": 705940,
    "text": "Does nothing (`0x0AC594`)."
   },
   {
    "name": "EnableKeyboard__Fv",
    "entry": 705984,
    "text": "Does nothing (`0x0AC5C0`)."
   },
   {
    "name": "DisableKeyboard__Fv",
    "entry": 706028,
    "text": "Does nothing (`0x0AC5EC`)."
   },
   {
    "name": "DisablePseudoMouse__Fv",
    "entry": 706072,
    "text": "Does nothing (`0x0AC618`)."
   },
   {
    "name": "HasISSupport__Fv",
    "entry": 706532,
    "text": "Returns the byte at `data+0x773BB` (`0x0AC7E4` to `0x0AC7E8`)."
   },
   {
    "name": "ISGetKeys__FPUl",
    "entry": 707708,
    "text": "Adds the game pad's state to a key map, when InputSprocket is there (the byte at\n`data+0x773BB`) and not suspended (the byte at `data+0x773BA`, `0x0ACC84` to\n`0x0ACCB0`). The pad, the element at `+12` of the list that `data+0x7738C` points\nto, gives a direction from 1 to 8 (`ISpElement_GetSimpleState`, `0x0ACCB4` to\n`0x0ACCEC`), and each sets one bit of bytes 10 and 11 of the map, the keypad's\n4, 7, 8, 9, 6, 3, 2 and 1 for 1 to 8 (`0x0ACCF0` to `0x0ACD68`). The element at\n`+36`, pressed, sets bit 1 of byte 6, the space bar (`0x0ACD6C` to `0x0ACD9C`). The keys' names come from Apple's key codes, an inference."
   },
   {
    "name": "ISButton__Fv",
    "entry": 708300,
    "text": "Returns 1 when the player presses any of the first three elements of the InputSprocket list, and 0 otherwise or when InputSprocket is absent or suspended (`0x0ACED4` to\n`0x0ACF58`)."
   },
   {
    "name": "HandleISPseudoMouse__Fv",
    "entry": 708500,
    "text": "Does nothing (`0x0ACF94`)."
   },
   {
    "name": "GetToken__FPPcPc",
    "entry": 712244,
    "text": "Copies the next token of a line into the buffer given and moves the pointer past\nit. It skips spaces and tabs before it (`0x0ADE40` to `0x0ADE78`). At the end of\nthe line, a line feed, a return or a 0 byte, the token is empty (`0x0ADE7C` to\n`0x0ADEAC`). Each of `#`, `(`, `)`, `.`, `,`, `\"`, `;` and `:` is a token alone (`0x0ADEB0` to `0x0ADF44`), and any other\ntoken runs to a space, a tab, the end of the line or one of those (`0x0ADF48` to\n`0x0AE034`). The token ends with a 0 byte, and the buffer has no bound."
   },
   {
    "name": "MatchStr__FsPcPcs",
    "entry": 712812,
    "text": "Returns the place of the first entry of the `'STR#'` list given, from 1 up to\n998, whose head is the start of the word given, or 0 when the list ends first\n(`GetIndString`, `0x0AE094` to `0x0AE220`). The routine skips an entry whose length byte is 59, the code for `;` (`0x0AE0BC` to `0x0AE0C4`), so it skips an entry of 59 characters and not one starting with `;`, a test meant for the\nfirst character (an inference). The head is the entry less its last n\ncharacters, n the fourth argument, and less a closing part in brackets\n(`0x0AE0C8` to `0x0AE1AC`), the search back for the `(` having no lower bound,\nso a `)` with no `(` reads before the buffer (`0x0AE150` to `0x0AE164`). The routine copies the last n characters, and then the text in the brackets, into the buffer in the third argument when there is one\n(`0x0AE0E0` to `0x0AE1AC`). The head matches when the word has each of its\ncharacters in order (`0x0AE1B0` to `0x0AE204`), so a longer word matches too."
   },
   {
    "name": "AppendSTRItem__FRPcss",
    "entry": 715492,
    "text": "Appends entry n of a `'STR#'` list to the text at the pointer given, moves the\npointer past it and ends the text with a 0 byte that the next call writes over\n(`GetIndString`, `0x0AEAFC` to `0x0AEB58`)."
   },
   {
    "name": "GetCombatAIName__FsPUc",
    "entry": 724392,
    "text": "Writes the name of combat AI n as a Pascal string. When resource `0x360` plus n\nexists with 32 bytes or more, the name is its first 32 bytes read as a Pascal\nstring (`0x0B0DC0` to `0x0B0E2C`). Otherwise it is \"Scenario Combat AI #\" and n\nless 207 for n from 208 up (`0x0B0E34` to `0x0B0E70`), and \"User Combat AI #\"\nand n less 175 below that (`0x0B0E78` to `0x0B0EA8`)."
   },
   {
    "name": "CompileAIFile__FR6FSSpecs",
    "entry": 724728,
    "text": "Compiles a combat AI source file into combat AI n of the user's file. It opens\nthe file (`FSp_fopen`, `0x0B0F28` to `0x0B0F38`) and reads it a line at a time, up to\n1,024 bytes (`0x0B0F54` to `0x0B0F6C`, an inference from the arguments of the\nruntime call). The routine passes over a line of spaces and tabs alone, and a line\nwhose first byte is `;`, a comment, but only in the first column, since the test is on the\nbuffer's first byte rather than the first after the spaces (`0x0B0F74` to\n`0x0B0FEC`). The first other line is the header (`SCombatAIHeader::CompileHeader`),\n32 bytes, and each line after it an entry (`SCombatAIEntry::CompileLine`), 8 bytes,\neach added to a handle (`PtrAndHand`, `0x0B0FF0` to `0x0B10C8`). On an error it\nprints `\"Line #%d: %s\"` with the line, and `\"Error with script header: %s\\n\"` or\n`\"Error with script code: %s\\n\"` with the error, to the status window that\n`data+0x64614` points to (`TStatusWindow::myprintf`), beeps and stops with nothing saved (`SysBeep`,\n`0x0B100C` to `0x0B1044`, `0x0B1078` to `0x0B10B0`). Otherwise, with a header, it\nsaves the handle as resource `0x360` plus n of the user's file that `data+0x181F0`\npoints to, writes the file's table or flushes the file, has the cache find the\nsegment again (`TSegFile::SaveSegment`, `TSegFile::SaveTOC`, `PBFlushFileSync`,\n`TCachedSegFiles::RefindSegment`, `0x0B10CC` to `0x0B1158`), and prints\n`\"Combat AI #%d compiled.\\n\"` with n less 175 (`0x0B1160` to `0x0B1170`). With no\nuser file open the routine skips the save, the table and the cache (`0x0B10E0` to\n`0x0B10F0`) and prints the same message, for a compiled AI that went nowhere. It then disposes of the\nhandle and closes the file (`0x0B1178` to `0x0B1188`)."
   },
   {
    "name": "MyFindSymbol",
    "entry": 728752,
    "text": "Returns the address of a symbol in a shared library, both named by the\narguments, or 0 when the library or the symbol is not found (`GetSharedLibrary`\nwith `'pwpc'`, `FindSymbol`, `0x0B1EB8` to `0x0B1F40`). The connection to the\nlibrary is not closed."
   }
  ]
 }
};

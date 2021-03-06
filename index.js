/* eslent-env node */
/* global xelib, registerPatcher, patcherUrl, info */

const {
  AddElement,
  EditorID,
  GetElement,
  GetElements,
  GetIntValue,
  GetLinksTo,
  GetValue,
  GetWinningOverride,
  HasElement,
  LongName,
  Release,
  SetIntValue,
  SetLinksTo,
  SetValue,
  Signature
} = xelib

const {
  now
} = Date

function releaseAll (handles) {
  for (const handle of handles) Release(handle)
}

function setLinksTo (parent, path, target) {
  const element = AddElement(parent, path)
  try {
    SetLinksTo(element, target, '')
  } finally {
    Release(element)
  }
}

function getLinkedEDID (element, path) {
  const target = GetLinksTo(element, path)
  try {
    return EditorID(target)
  } finally {
    Release(target)
  }
}

function mapMap (map, fn) {
  const result = []
  for (const item of map.values()) {
    result.push(fn(item))
  }
  return result
}

function getWinningOverride (handle) {
  const newHandle = GetWinningOverride(handle)
  if (newHandle !== handle) Release(handle)
  return newHandle
}

function mapGetOrDefault (map, key, func) {
  if (!map.has(key)) {
    map.set(key, func())
  }
  return map.get(key)
}

function sortObjectByKey (object) {
  for (const key of Object.keys(object).sort()) {
    const temp = object[key]
    delete object[key]
    object[key] = temp
  }
}

function multiplyNPCs (data, helpers, locals) {
  const { logMessage, copyToPatch, cacheRecord } = helpers
  const { npcs, targetCount, longName } = data
  const { newNPCs } = locals

  let { count } = data

  logMessage(`Creating ${targetCount - count} new NPCs for ${longName}`)

  let progressTime = now() + 2000
  let leastClones = 0
  let nextleastClones = npcs.values().next().value.clones.size
  while (count < targetCount) {
    for (const { npc, npcEDID, lvlns, clones, flsts } of npcs) {
      let cloneCount = clones.size
      if (cloneCount === leastClones) {
        const newEDID = `${npcEDID}_acot${cloneCount}`
        const newNPC = cacheRecord(copyToPatch(npc, true), newEDID)
        clones.add(newNPC)

        for (const lvln of lvlns) {
          lvln.count++
          lvln.llentry.get(npcEDID).newNpcs.add(newNPC)
        }
        for (const flst of flsts) {
          flst.count++
          flst.newNpcs.add(newNPC)
        }
        newNPCs.push(newNPC)

        if (now() > progressTime) {
          logMessage(`Created a total of ${newNPCs.length} new NPC_s...`)
          progressTime = now() + 2000
        }
        cloneCount++
        count++
        if (count >= targetCount) break
      }
      if (cloneCount < nextleastClones) {
        nextleastClones = cloneCount
      }
    }
    leastClones = nextleastClones
    nextleastClones = nextleastClones + 1
  }
}

registerPatcher({
  info: info,
  gameModes: [xelib.gmFO4],
  settings: {
    label: 'A Cast of Thousands',
    templateUrl: `${patcherUrl}/partials/settings.html`,
    controller: function ($scope) {
      const patcherSettings = $scope.settings.aCastOfThousands

      const lvlnList = $scope.lvlnList = patcherSettings.lvlnList
      sortObjectByKey(lvlnList)

      $scope.removeList = key => delete lvlnList[key]

      $scope.addList = () => {
        lvlnList['#AListToMultiply'] = 20
        sortObjectByKey(lvlnList)
      }
    },
    defaultSettings: {
      patchFileName: 'zPatch.esp',
      seed: 42,
      lvlnList: {
        DLC06LCharWorkshopNPC: 20,
        DLC03_LCharTrapperFace: 20,
        DLC03LCharWorkshopNPC: 120,
        DLC04_LCharRaiderDiscipleFace: 20,
        DLC04_LCharRaiderOperatorFace: 20,
        DLC04_LCharRaiderPackFace: 20,
        DLC04LCharWorkshopRaiderA: 20,
        DLC04LCharWorkshopRaiderASpokesperson: 20,
        DLC04LCharWorkshopRaiderB: 20,
        DLC04LCharWorkshopRaiderBSpokesperson: 20,
        DLC04LCharWorkshopRaiderC: 20,
        DLC04LCharWorkshopRaiderCSpokesperson: 20,
        kgSIM_Civilians_Commonwealth: 140,
        kgSIM_Civilians_FarHarbor: 40,
        kgSIM_DefaultGenericVisitorForms: 140,
        kgSIM_LChar_IndRev_IronMineWorkerNPC: 20,
        kgSIM_LCharEnslavedSettler: 20,
        LCharBoSTraitsSoldier: 20,
        LCharChildrenofAtomFaces: 20,
        LCharGunnerFaceAndGender: 20,
        LCharMinutemenFaces: 20,
        LCharRaiderFaceAndGender: 20,
        LCharRRAgentFace: 20,
        LCharScavenger: 20,
        LCharTriggermanHumanFaces: 20,
        LCharWorkshopGuard: 20,
        LCharWorkshopNPC: 1280,
        simvault_Minutefans: 20,
        tkz_LCharBOSFaceAndGender: 20
      }
    }
  },
  execute: (patchFile, helpers, settings, locals) => ({
    initialize: function initializeACastOfThousands (patchFile, helpers, settings, locals) {
      const { logMessage, loadRecords } = helpers

      const lvlns = new Map()
      const flsts = new Map()
      const lvlnsToMultiply = locals.lvlnsToMultiply = new Map()
      const lvlnsToModify = locals.lvlnsToModify = new Map()
      const flstsToMultiply = locals.flstsToMultiply = new Map()
      const flstsToModify = locals.flstsToModify = new Map()

      for (let lvln of loadRecords('LVLN', false)) {
        lvln = getWinningOverride(lvln)
        if (!HasElement(lvln, 'Leveled List Entries')) {
          Release(lvln)
          continue
        }
        const edid = EditorID(lvln)
        lvlns.set(edid, {
          lvln: lvln,
          edid: edid,
          llentry: new Map(),
          count: 0
        })
      }

      for (let flst of loadRecords('FLST', false)) {
        flst = getWinningOverride(flst)
        if (!HasElement(flst, 'FormIDs')) {
          Release(flst)
          continue
        }
        const edid = EditorID(flst)
        flsts.set(edid, {
          flst: flst,
          edid: edid,
          newNpcs: new Set(),
          count: 0
        })
      }

      const npcs = new Map()
      function recordNPC (npc) {
        const npcEDID = EditorID(npc)
        if (npcs.has(npcEDID)) {
          Release(npc)
          return npcs.get(npcEDID)
        }
        npc = getWinningOverride(npc)
        const data = {
          npc: npc,
          npcEDID: npcEDID,
          lvlns: new Set(),
          flsts: new Set(),
          clones: new Set()
        }
        npcs.set(npcEDID, data)
        return data
      }

      function recordEntry (entry, lvlnData, npcData) {
        const { llentry } = lvlnData
        const { npcEDID } = npcData
        const { entries } = mapGetOrDefault(llentry, npcEDID, () => ({
          entries: new Set(),
          newNpcs: new Set()
        }))
        const lvlo = GetElement(entry, 'LVLO')
        try {
          const data = {
            level: GetIntValue(lvlo, 'Level'),
            count: GetIntValue(lvlo, 'Count'),
            chanceNone: GetIntValue(lvlo, 'Chance None')
          }
          const coed = GetElement(entry, 'COED')
          if (coed) {
            try {
              data.owner = GetValue(coed, 'Owner')
              data.condition = GetValue(coed, 'Item Condition')
              if (HasElement(coed, 'Global Variable')) data.globalVariable = GetValue(coed, 'Global Variable')
              if (HasElement(coed, 'Required Rank')) data.requiredRank = GetValue(coed, 'Required Rank')
            } finally {
              Release(coed)
            }
          }
          entries.add(data)
        } finally {
          Release(lvlo)
        }
      }

      const lvlnList = settings.lvlnList
      for (const edid in lvlnList) {
        const count = lvlnList[edid]
        const lvlnData = lvlns.get(edid)
        const flstData = flsts.get(edid)
        if (lvlnData) {
          lvlns.delete(edid) // so we don't process this again below.
          const lvln = lvlnData.lvln
          const longName = lvlnData.longName = LongName(lvln)
          lvlnData.targetCount = count
          logMessage(`Collecting the NPCs in ${longName}`)
          const npcSet = new Set()
          const entries = GetElements(lvln, 'Leveled List Entries')
          try {
            for (const entry of entries) {
              const npcData = recordNPC(GetLinksTo(entry, 'LVLO - Base Data\\Reference'))
              npcSet.add(npcData)
              npcData.lvlns.add(lvlnData)
              recordEntry(entry, lvlnData, npcData)
            }
          } finally {
            releaseAll(entries)
          }
          lvlnData.npcs = npcSet
          lvlnData.count = npcSet.size
          if (npcSet.size === 0) {
            Release(lvln)
            logMessage('[WARN] No NPCs found to duplicate, skipping this LVLN')
            continue
          }
          lvlnsToMultiply.set(edid, lvlnData)
          lvlnsToModify.set(edid, lvlnData)
        } else if (flstData) {
          flsts.delete(edid) // so we don't process this again below.
          const flst = flstData.flst
          const longName = flstData.longName = LongName(flst)
          flstData.targetCount = count
          logMessage(`Collecting the NPCs in ${longName}`)
          const npcSet = new Set()
          const entries = GetElements(flst, 'FormIDs')
          try {
            for (const entry of entries) {
              const npcData = recordNPC(GetLinksTo(entry, ''))
              npcSet.add(npcData)
              npcData.flsts.add(flstData)
            }
          } finally {
            releaseAll(entries)
          }
          flstData.npcs = npcSet
          flstData.count = npcSet.size
          if (npcSet.size === 0) {
            Release(flst)
            logMessage('[WARN] No NPCs found to duplicate, skipping this FLST')
            continue
          }
          flstsToMultiply.set(edid, flstData)
          flstsToModify.set(edid, flstData)
        } else {
          logMessage(`[WARN] Couldn't find a LVLN or a FLST named ${edid}`)
        }
      }

      logMessage('Finding other LVLNs that include the NPCs we will duplicate')
      for (const [lvlnEDID, lvlnData] of lvlns) {
        const lvln = lvlnData.lvln
        let found = false
        const entries = GetElements(lvln, 'Leveled List Entries')
        try {
          for (const entry of entries) {
            const npcEDID = getLinkedEDID(entry, 'LVLO - Base Data\\Reference')
            if (!npcs.has(npcEDID)) continue
            found = true
            const npcData = npcs.get(npcEDID)
            npcData.lvlns.add(lvlnData)
            recordEntry(entry, lvlnData, npcData)
          }
        } finally {
          releaseAll(entries)
        }
        if (!found) {
          Release(lvln)
          continue
        }
        const longName = lvlnData.longName = LongName(lvln)
        logMessage(`Found ${longName} which includes NPCs we are duplicating`)
        lvlnsToModify.set(lvlnEDID, lvlnData)
      }

      logMessage('Finding other FLSTs that include the NPCs we will duplicate')
      for (const [flstEDID, flstData] of flsts) {
        const flst = flstData.flst
        let skip = false
        const flstNpcs = new Map()
        const formIDs = GetElements(flst, 'FormIDs')
        try {
          for (const formID of formIDs) {
            const npc = GetLinksTo(formID)
            try {
              if (Signature(npc) !== 'NPC_') {
                skip = true
                break
              }
              const npcEDID = EditorID(npc)
              const npcData = npcs.get(npcEDID)
              if (npcData) flstNpcs.set(npcEDID, npcData)
            } finally {
              Release(npc)
            }
          }
        } finally {
          releaseAll(formIDs)
        }
        if (skip || flstNpcs.size === 0) {
          Release(flst)
          continue
        }
        for (const npcData of flstNpcs.values()) {
          npcData.flsts.add(flstData)
        }
        const longName = flstData.longName = LongName(flst)
        logMessage(`Found ${longName} which includes NPCs we are duplicating`)
        flstsToModify.set(flstEDID, flstData)
      }

      locals.newNPCs = []
    },
    process: [
      {
        records: (filesToPatch, helpers, settings, locals) => mapMap(locals.lvlnsToMultiply, d => d.lvln),
        patch: (lvln, helpers, settings, locals) => multiplyNPCs(locals.lvlnsToMultiply.get(EditorID(lvln)), helpers, locals)
      },
      {
        records: (filesToPatch, helpers, settings, locals) => mapMap(locals.flstsToMultiply, d => d.flst),
        patch: (flst, helpers, settings, locals) => multiplyNPCs(locals.flstsToMultiply.get(EditorID(flst)), helpers, locals)
      },
      {
        records: (filesToPatch, helpers, settings, locals) => mapMap(locals.lvlnsToModify, d => d.lvln),
        patch: function addNPCstolvln (lvln, helpers, settings, locals) {
          const { llentry, longName } = locals.lvlnsToModify.get(EditorID(lvln))
          helpers.logMessage(`Adding new NPC_s to ${longName}`)
          const entrylist = GetElement(lvln, 'Leveled List Entries')
          try {
            for (const { newNpcs, entries } of llentry.values()) {
              for (const entry of entries) {
                const { level, count, chanceNone, owner, condition, globalVariable, requiredRank } = entry
                for (const npc of newNpcs) {
                  const element = AddElement(entrylist, '.')
                  try {
                    const lvlo = AddElement(element, 'LVLO')
                    try {
                      SetIntValue(lvlo, 'Level', level)
                      SetIntValue(lvlo, 'Count', count)
                      SetLinksTo(lvlo, npc, 'Reference')
                      SetIntValue(lvlo, 'Chance None', chanceNone)
                    } finally {
                      Release(lvlo)
                    }
                    if (!owner) break
                    const coed = AddElement(element, 'COED')
                    try {
                      SetValue(coed, 'Owner', owner)
                      SetValue(coed, 'Item Condition', condition)
                      if (globalVariable) SetValue(coed, 'Global Variable', globalVariable)
                      if (requiredRank) SetValue(coed, 'Required Rank', requiredRank)
                    } finally {
                      Release(coed)
                    }
                  } finally {
                    Release(element)
                  }
                }
              }
            }
          } finally {
            Release(entrylist)
          }
        }
      },
      {
        records: (filesToPatch, helpers, settings, locals) => mapMap(locals.flstsToModify, d => d.flst),
        patch: function addNPCstoflst (flst, helpers, settings, locals) {
          const { newNpcs, longName } = locals.flstsToModify.get(EditorID(flst))
          helpers.logMessage(`Adding new NPC_s to ${longName}`)
          const formIDs = GetElement(flst, 'FormIDs')
          try {
            for (const npc of newNpcs) {
              setLinksTo(formIDs, '.', npc)
            }
          } finally {
            Release(formIDs)
          }
        }
      }
    ],
    finalize: function (patchFile, helpers, settings, locals) {
      for (const newNPC of locals.newNPCs) {
        Release(newNPC)
      }
      for (const flstData of locals.flstsToModify.values()) {
        Release(flstData.flst)
      }
      for (const lvlnData of locals.lvlnsToModify.values()) {
        Release(lvlnData.lvln)
      }
    }
  })
})

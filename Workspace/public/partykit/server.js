// ============================================================
// party-server.js — PartyKit server for TinyBase sync
// ============================================================
// The TinyBase PartyKit persister sends CRDT sync messages here.
// We rely on TinyBasePersisterPartyKitServer to handle storage
// and broadcasting, with a small PartyKit lifecycle wrapper.

import { TinyBasePersisterPartyKitServer } from 'tinybase/persisters/persister-partykit-server';

export default class {
  constructor(party) {
    this.party = party;
    this.server = new TinyBasePersisterPartyKitServer(party);
  }

  async onConnect(connection) {
    // Handled by the TinyBase persister
  }

  async onMessage(message, sender) {
    // TinyBase persister handles message routing internally
  }
}

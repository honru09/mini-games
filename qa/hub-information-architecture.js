#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(ROOT, 'public', 'index-template.html'), 'utf8');
const roster = fs.readFileSync(path.join(ROOT, 'public', 'src', 'ui', '07-roster.js'), 'utf8');
const shell = fs.readFileSync(path.join(ROOT, 'public', 'src', 'core', '02-app-shell.js'), 'utf8');

let failed = 0;
function check(name, condition) {
  if (condition) console.log('PASS', name);
  else { failed += 1; console.error('FAIL', name); }
}

function section(source, start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  return from >= 0 && to > from ? source.slice(from, to) : '';
}

const home = section(template, 'data-app-route="home"', 'data-app-route="games"');
const games = section(template, 'data-app-route="games"', 'data-app-route="playline"');
const profileStart = template.indexOf('data-app-route="profile"');
const profile = profileStart >= 0 ? template.slice(profileStart) : '';

check('Home does not duplicate a compact player profile',
  !/home-pulse-identity|id="my-card"|id="btn-me"/.test(home));

check('Games owns two explicit, keyboard-addressable Library and Rooms views',
  /id="games-workspace-tabs"/.test(games) &&
  /data-games-workspace-target="library"/.test(games) &&
  /data-games-workspace-target="rooms"/.test(games) &&
  /id="games-library-panel"/.test(games) &&
  /id="games-rooms-panel"/.test(games));

check('Games route no longer renders the full player identity card',
  !/id="my-card"|id="btn-me"/.test(games));

const libraryStart = games.indexOf('id="games-library-panel"');
const roomsStart = games.indexOf('id="games-rooms-panel"');
const library = libraryStart >= 0 && roomsStart > libraryStart ? games.slice(libraryStart, roomsStart) : '';
const rooms = roomsStart >= 0 ? games.slice(roomsStart) : '';
check('Game catalog and room lifecycle have separate DOM owners',
  /id="game-grid"/.test(library) &&
  !/id="lobby-panel"|id="room-panel"|id="online-status"/.test(library) &&
  /id="lobby-panel"/.test(rooms) &&
  /id="room-panel"/.test(rooms) &&
  /id="online-status"/.test(rooms) &&
  !/id="game-grid"/.test(rooms));

check('Games workspace tabs switch one view without route or page reload',
  /function setGamesWorkspaceView\(view/.test(roster) &&
  /data-games-workspace-target/.test(roster) && /data-games-workspace-panel/.test(roster) &&
  /aria-selected/.test(roster));

check('Create, browse, and private-code actions reveal the Rooms owner first',
  /btn-create-room[\s\S]{0,500}setGamesWorkspaceView\('rooms'\)/.test(roster) &&
  /btn-browse-rooms[\s\S]{0,500}setGamesWorkspaceView\('rooms'\)/.test(roster) &&
  /btn-join-private[\s\S]{0,500}setGamesWorkspaceView\('rooms'\)/.test(roster));

check('Achievements remain aggregated in Profile rather than Home or Games',
  /id="ghost-profile-overview"/.test(profile) &&
  /profile_achievements_title/.test(shell) &&
  !/achievement/i.test(home) && !/achievement/i.test(games));

check('Workspace layout has explicit phone and tablet/desktop contracts',
  /\.games-workspace-tabs/.test(template) &&
  /@media\(max-width:640px\)[\s\S]*\.games-workspace-tabs/.test(template) &&
  /@media\(min-width:641px\)[\s\S]*\.games-workspace/.test(template));

check('Games side rail can shrink and wrap leaderboard controls without page overflow',
  /\.games-workspace-main,\.games-workspace-side\{[^}]*min-width:0/.test(template) &&
  /\.games-workspace-side \.lb-panel\{[^}]*min-width:0/.test(template) &&
  /\.games-workspace-side \.lb-head\{[^}]*flex-wrap:wrap/.test(template) &&
  /\.games-workspace-side \.lb-tabs\{[^}]*margin-left:auto/.test(template));

if (failed) {
  console.error(`HUB_INFORMATION_ARCHITECTURE_FAIL ${failed}`);
  process.exit(1);
}
console.log('HUB_INFORMATION_ARCHITECTURE_ALL_PASS');

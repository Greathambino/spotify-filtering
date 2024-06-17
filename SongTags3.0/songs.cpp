/*
songs.cpp 3.0
Wyatt Hamabe
*/

#ifndef SONGS_CPP
#define SONGS_CPP

#include <utility>
#include <vector>
#include <iostream>
#include <iterator>
#include <set>
#include "song.h"
#include "songs.h"

using namespace std;

ostream& operator<<(ostream& os, const Songs& other) {
    os << "";
    int i = 1;
    for (auto elem : other.songs) {
        cout << i << ": " << elem << endl;
        i++;
    }
    return os;
}

Songs::Songs() {
}
Songs::Songs(vector<Song> s) {
    for (auto elem: s) {
        addSong(elem);
    }
}
int Songs::getSize() {
    return songs.size();
}
bool Songs::addSong(Song s) {
    return songs.insert(s).second;
}
bool Songs::addSongs(vector<Song> sngs) {
    bool insertedFlag = true;
    for (auto elem : sngs) {
        if (!addSong(elem)) {
            insertedFlag = false;
        }
    }
    return insertedFlag;
}
bool Songs::removeSong(string name) {
    // auto removeThis = songs.find(songs.begin(), songs.end(), Song(name, ""));
    // songs.erase(removeThis);
    return false;
}
bool Songs::hasSong(string name) {
    return false;
}
Song Songs::getSongCopy(int num) {
    Song ret("", "");

    return ret;
}
set<Song>::iterator Songs::getIteratorFor(int num) {
    auto itr = songs.begin();

    return itr;
}


Songs Songs::filterIncluding(set<string> tags) {
    Songs ret;

    return ret;
}
Songs Songs::filterExcluding(set<string> tags) {
    Songs ret;

    return ret;
}


#endif

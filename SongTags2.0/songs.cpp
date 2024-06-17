/*
songs.cpp 2.0
Wyatt Hamabe
*/

#ifndef SONGS_CPP
#define SONGS_CPP

#include <vector>
#include <utility>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"
#include "tags.h"
#include "song.h"
#include "songs.h"

using namespace std;

ostream& operator<<(ostream& os, Songs& other) {
    os << "";
    if (other.songs.empty()) {
        return os;
    }
    int i = 1;
    for (auto elem : other.songs) {
        os << i << ": " << elem << endl;
        i++;
    }
    return os;
}



Songs::Songs() {

}
Songs::Songs(vector<Song> s) {
    for (auto elem : s) {
        addSong(elem);
    }
}
int Songs::getSize() {
    return songs.size();
}
bool Songs::addSong(Song s) {
    return songs.insert(s).second;
}
bool Songs::hasSong(string name) {
    return songs.find(Song(name, "")) != songs.end();
}
set<Song>::iterator Songs::getIteratorForName(string title) {
    if (hasSong(title)) {
        return songs.find(Song(title, ""));
    }
    return songs.end();
}



// Songs Songs::filterIncluding(Tags t) {
//     return;
// }
// Songs Songs::filterExcluding(Tags t) {
//     return;
// }



#endif
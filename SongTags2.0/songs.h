/*
songs.h 2.0
Wyatt Hamabe
*/

#ifndef SONGS_H
#define SONGS_H

#include <vector>
#include <utility>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"
#include "tags.h"
#include "song.h"

using namespace std;

class Songs {
    public:
        Songs();
        Songs(vector<Song> s);
        int getSize();
        bool addSong(Song s);
        bool hasSong(string name);
        set<Song>::iterator getIteratorForName(string title);
        friend ostream& operator<<(ostream& os, Songs& other);

        // Songs filterIncluding(Tags t);
        // Songs filterExcluding(Tags t);

    private:
        set<Song> songs;
};




#endif
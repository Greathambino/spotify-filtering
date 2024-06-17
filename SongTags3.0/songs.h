/*
songs.h 3.0
Wyatt Hamabe
*/

#ifndef SONGS_H
#define SONGS_H

#include <utility>
#include <vector>
#include <iostream>
#include <iterator>
#include <set>
#include "song.h"

using namespace std;

class Songs {
    public:
        Songs();
        Songs(vector<Song> s);

        int getSize();
        bool addSong(Song s);
        bool addSongs(vector<Song> sngs);
        bool removeSong(string name);
        bool hasSong(string name);
        Song getSongCopy(int num);
        set<Song>::iterator getIteratorFor(int num);
        friend ostream& operator<<(ostream& os, const Songs& other);

        Songs filterIncluding(set<string> tags);
        Songs filterExcluding(set<string> tags);

    private:
        set<Song> songs;
};



#endif



/*
song.h 2.0
Wyatt Hamabe
*/

#ifndef SONG_H
#define SONG_H

#include <vector>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"
#include "tags.h"

using namespace std;

class Song {
    public:
        Song();
        Song(string t, string a);
        int getValue();
        void factoryTagFrom(Tags& allTags, string name);
        void factoryTagsFrom(Tags& allTags, vector<string> names);
        bool hasTag(string name);
        bool removeTag(string name);
        friend ostream& operator<<(ostream& os, const Song& other);
        friend bool operator==(const Song& RHS, const Song& LHS);
        friend bool operator<(const Song& RHs, const Song& LHS);

    private:
        string title;
        string artist;
        //only add or remove from it
        Tags sTags;
        int value;

};

#endif

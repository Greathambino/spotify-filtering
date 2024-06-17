/*
song.h 3.0
Wyatt Hamabe
*/

#ifndef SONG_H
#define SONG_H

#include <utility>
#include <vector>
#include <iostream>
#include <iterator>
#include <set>

using namespace std;

class Song {
    public:
        Song();
        Song(string t, string a);
        string getTitle() const;
        string getArtist() const;
        set<string> getTags() const;
        bool hasTag(string name);
        bool addTag(string name);
        bool addTags(vector<string> names);
        bool removeTag(string name);
        friend ostream& operator<<(ostream& os, const Song& other);
        friend bool operator<(const Song& LHS, const Song& RHS);
        friend bool operator==(const Song& LHS, const Song& RHS);

    private:
        set<string> tags;
        string title;
        string artist;
};

#endif


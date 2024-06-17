/*
song.cpp 2.0
Wyatt Hamabe
*/

#ifndef SONG_CPP
#define SONG_CPP

#include <vector>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"
#include "tags.h"
#include "song.h"

using namespace std;

ostream& operator<<(ostream& os, const Song& other) {
    os << "";
    os << other.title << ", by " << other.artist << endl;
    os << other.sTags;
    return os;
}
bool operator==(const Song& RHS, const Song& LHS) {
    return RHS.title == LHS.title;
}
bool operator<(const Song& RHS, const Song& LHS) {
    return RHS.title < LHS.title;
}

Song::Song() : title("Unknown"), artist("Unknown"), value(1) {
}
Song::Song(string t, string a) : title(t), artist(a), value(1) {
}
int Song::getValue() {
    return value;
}
// add from allTags to sTags if it exists
// otherwise, create and add to allTags and to sTags
void Song::factoryTagFrom(Tags& allTags, string name) { 
    if (!hasTag(name)) {
        Tag t = allTags.factoryTag(name);
        sTags.directTagAdd(t);
        value *= t.getValue();
    } 
}
void Song::factoryTagsFrom(Tags& allTags, vector<string> names) {
    for (auto elem: names) {
        factoryTagFrom(allTags, elem);
    }
}

bool Song::hasTag(string name) {
    return sTags.hasTag(name);
}

bool Song::removeTag(string name) {
    if (hasTag(name)) {
        sTags.removeTag(name);
        return true;
    }
    return false;
}





#endif
/*
song.cpp 3.0
Wyatt Hamabe
*/

#ifndef SONG_CPP
#define SONG_CPP

#include <utility>
#include <vector>
#include <iostream>
#include <iterator>
#include <set>
#include "song.h"

using namespace std;

ostream& operator<<(ostream& os, const Song& other) {
    os << other.title << ", by " << other.artist << endl;
    auto itr = other.tags.begin();
    os << "   [ ";
    auto temp = other.tags.end();
    temp--;
    while (itr != temp) {
        os << *itr << ", ";
        itr++;
    }
    os << *itr << " ]";
    return os;
}
bool operator<(const Song& LHS, const Song& RHS) {
    return LHS.title < RHS.title;
}
bool operator==(const Song& LHS, const Song& RHS) {
    return LHS.title == RHS.title;
}

Song::Song() : title(""), artist("") {

}
Song::Song(string t, string a) : title(t), artist(a) {
}
string Song::getTitle() const {
    return title;
}
string Song::getArtist() const {
    return artist;
}
set<string> Song::getTags() const {
    return tags;
}
bool Song::hasTag(string name) {
    return tags.find(name) != tags.end();
}
bool Song::addTag(string name) {
    return tags.insert(name).second;
}
bool Song::addTags(vector<string> names) {
    bool insertedFlag = true;
    for (auto elem : names) {
        if (!addTag(elem)) {
            insertedFlag = false;
        }
    }
    return insertedFlag;
}
bool Song::removeTag(string name) {
    return tags.erase(name) >= 1;
}




#endif

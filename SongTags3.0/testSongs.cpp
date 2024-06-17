/*
testSongs.cpp 3.0
Wyatt Hamabe
Help: Tyler Ekaireb - use set to store tags

Filtering songs may be slower?
*/
#include <utility>
#include <vector>
#include <iostream>
#include <iterator>
#include <set>
#include "song.h"
#include "songs.h"

using namespace std;

int main (int argc, char** argv) {

    Song s1("My Boo", "Usher");
    s1.addTags({"Usher", "RnB", "Mellow", "2000s"});
    // vector<string> s1Tags = {"Usher", "RnB", "Mellow", "2000s"};
    // s1.addTags(s1Tags);
    

    Song s2("Japanese Denim", "Daniel Caesar");
    s2.addTags({"Daniel Caesar", "Rnb", "Mellow", "Favorite", "Sing"});

    cout << "Song 1: " << endl << s1 << endl;
    cout << "Song 2: " << endl << s2 << endl;

    Songs songs;
    songs.addSong({s1, s2});
    
    cout << "Songs: " << endl << songs << endl;


    return 0;
}



/*
testSongs.cpp 2.0
Wyatt Hamabe
Help:
Forrest Ramirez - Factory for tags
GeeksforGeeks website - prime functions + general syntax help

little issue: int cant hold very big numbers...

ordered set to hold tags

*/

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

int main (int argc, char** argv) {

    Tags allTags;
    allTags.factoryTag("Test");
    /* testing allTags
    allTags.factoryTag("Mellow");
    allTags.factoryTag("Rap");
    allTags.factoryTag("Mellow");
    allTags.factoryTag("Test");
    //cout << "allTags: " << endl << allTags << endl;
    */

    /* testing set
    set<int> test;
    test.insert(4);
    test.insert(5);
    set<int>::iterator i = test.end();
    cout << *i << endl;
    */
    
    /* testing Song
    cout << "allTags: " << endl << allTags << endl;
    cout << "s1: " << endl << s1 << endl;
    // cout << boolalpha << s1.hasTag("Rap") << endl;
    // cout << boolalpha << s1.hasTag("Mellow") << endl;
    // cout << boolalpha << s1.removeTag("Mellow") << endl;
    cout << endl << "After Removal: " << endl;
    cout << "allTags: " << endl << allTags << endl;
    cout << "s1: " << endl << s1 << endl;
    */

    Song s1("Best I Ever Had", "Drake");
    vector<string> s1Tags = {"Rap", "Mellow", "Drake"};
    s1.factoryTagsFrom(allTags, s1Tags);
    
    Songs songs;
    songs.addSong(s1);

    const Song* ptr = &(*songs.getIteratorForName("Best I Ever Had"));

    //*(songs.getIteratorForName("Best I Ever Had")).factoryTagFrom(allTags, "Favorite");
    cout << *songs.getIteratorForName("Best I Ever Had");

    /* testing songs
    cout << "songs: " << endl << songs << endl;
    cout << "songs size: " << songs.getSize() << endl;
    cout << "songs has Best I...: " << boolalpha << songs.hasSong("Best I Ever Had") << endl;
    */

    return 0;
}





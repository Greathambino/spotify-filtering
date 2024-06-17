/*
tags.h 2.0
Wyatt Hamabe
*/

#ifndef TAGS_H
#define TAGS_H

#include <vector>
#include <utility>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"

using namespace std;

class Tags {
    public:
        Tags();
        Tags(int max);
        /* tries to return the existing tag
        but if it doesn't already exist it'll make
        a new one and add to the list, THEN return it */
        Tag factoryTag(string name); 
        set<Tag> factoryTags(vector<string> names);
        friend ostream& operator<<(ostream& os, const Tags& other);
        bool hasTag(string name);
        void directTagAdd(Tag t);
        int getTagsLength();
        Tag getTagFor(string name); 
        void removeTag(string name);

    private:
        set<Tag> tags;
        int currMax;
};

#endif
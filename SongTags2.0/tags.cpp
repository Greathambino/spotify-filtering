/*
tags.cpp 2.0
Wyatt Hamabe
https://www.geeksforgeeks.org/program-to-find-the-next-prime-number/
^ for prime functions
*/

#ifndef TAGS_CPP
#define TAGS_CPP

#include <vector>
#include <utility>
#include <iostream>
#include <iterator>
#include <set>
#include "tag.h"
#include "tags.h"

using namespace std;

bool isPrime(int n) {
    if (n <= 1)  return false;
    if (n <= 3)  return true;
   
    // This is checked so that we can skip 
    // middle five numbers in below loop
    if (n%2 == 0 || n%3 == 0) return false;
   
    for (int i=5; i*i<=n; i=i+6)
        if (n%i == 0 || n%(i+2) == 0)
           return false;
   
    return true;
}
int nextPrime(int N) {
    // Base case
    if (N <= 1)
        return 2;
 
    int prime = N;
    bool found = false;
    // Loop continuously until isPrime returns
    // true for a number greater than n
    while (!found) {
        prime++;
        if (isPrime(prime))
            found = true;
    }
 
    return prime;
}

ostream& operator<<(ostream& os, const Tags& other) {
    /*
    set<Tag>::iterator itr = other.tags.begin();
    os << "[ " << itr->getName() << ": " << itr->getValue() << endl;
    for (itr = other.tags.begin()+1; itr != other.tags.end(); itr++) {
    }
    */
    /*
    os << "[ ";
    for (auto elem : other.tags) {
        os << elem.getName() << ": " << elem.getValue() << endl << "  ";
    }
    */
    if (other.tags.empty()) {
        os << "";
        return os;
    }
    set<Tag>::iterator itr = other.tags.begin();
    os << "[ " << *itr << endl;
    itr++;
    set<Tag>::iterator end = other.tags.end();
    end--;
    while (itr != end) {
        os << "  " << *itr << endl;
        itr++;
    }
    os << "  " << *itr << " ]";
    return os;
}



Tags::Tags() : currMax(0) {
}
Tags::Tags(int max) : currMax(max) {
}

/* tries to return the existing tag
but if it doesn't already exist it'll make
a new one and add to the list, THEN return it */
Tag Tags::factoryTag(string name) {
    // how will i know the value paired w/ name if it exists?
    // 1: check if tg points to existing, return it ????
    if (hasTag(name)) {
        return getTagFor(name);
    }
    // 2: if not, make a new Tag
    currMax = nextPrime(currMax);
    Tag newt(name, currMax);
    // 3: add tag to tags list
    directTagAdd(newt);
    // 4: return the new tag
    return newt;
}

set<Tag> Tags::factoryTags(vector<string> names) {
    set<Tag> ret;
    for(auto elem : names) {
        ret.insert(factoryTag(elem));
    }
    return ret;
}

bool Tags::hasTag(string name) {
    auto pos = tags.find(Tag(name, -1));
    return pos != tags.end();
}

void Tags::directTagAdd(Tag t) {
    tags.insert(t);
}

int Tags::getTagsLength() {
    return tags.size();
}

//return *tags.find(Tag(name, -1));
Tag Tags::getTagFor(string name) {
    if (hasTag(name)) {
        return *tags.find(Tag(name, -1));
    } else {
        return Tag("", -1);
    }
}
void Tags::removeTag(string name) {
    if (hasTag(name)) {
        tags.erase(tags.find(Tag(name, -1)));
    }
}


#endif
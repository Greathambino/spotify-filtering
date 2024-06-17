/*
tag.h 2.0
Wyatt Hamabe
*/

#ifndef TAG_H
#define TAG_H

#include <vector>
#include <utility>
#include <iostream>
#include <iterator>
#include <set>

using namespace std;



class Tag {
    public:
        Tag();
        Tag(string  n, int v);
        string getName();
        int getValue();
        friend bool operator<(const Tag& LHS, const Tag& RHS);
        friend bool operator>(const Tag& LHS, const Tag& RHS);
        friend bool operator==(const Tag& LHS, const Tag& RHS);
        friend ostream& operator<<(ostream& os, const Tag& other);

    private:
        string name;
        int value;

};

#endif